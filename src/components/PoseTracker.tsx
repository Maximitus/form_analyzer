import { useCallback, useEffect, useRef, useState } from 'react';
import { RtmposeClient } from '../pose/rtmposeClient';
import { KeypointOneEuroFilter } from '../utils/oneEuroFilter';
import { computeClinicalAngles } from '../utils/kinematics';
import { drawJointAngleLabels, drawSkeleton } from '../utils/drawSkeleton';
import { COCO_KEYPOINT_COUNT, COCO_KEYPOINT_NAMES } from '../types/pose';
import type { ClinicalAngles, PoseFrame, RtmposeVariant } from '../types/pose';

export interface PoseTrackerProps {
  videoFile?: File | null;
  mediaStream?: MediaStream | null;
  modelVariant?: RtmposeVariant;
  showAngles?: boolean;
  onAngles?: (angles: ClinicalAngles) => void;
  onPose?: (pose: PoseFrame) => void;
  onStatus?: (status: string) => void;
  drawOverlay?: (ctx: CanvasRenderingContext2D, pose: PoseFrame) => void;
}

type VideoFrameCallback = (
  now: number,
  metadata: { mediaTime: number; presentedFrames?: number },
) => void;

function keypointsFromSmooth(
  xs: Float32Array,
  ys: Float32Array,
  scores: Float32Array,
): PoseFrame['keypoints'] {
  return Array.from({ length: Math.min(COCO_KEYPOINT_COUNT, xs.length) }, (_, i) => ({
    x: xs[i],
    y: ys[i],
    score: scores[i],
    name: COCO_KEYPOINT_NAMES[i],
  }));
}

export function PoseTracker({
  videoFile = null,
  mediaStream = null,
  modelVariant = 's',
  showAngles = true,
  onAngles,
  onPose,
  onStatus,
  drawOverlay,
}: PoseTrackerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<RtmposeClient | null>(null);
  const smootherRef = useRef(new KeypointOneEuroFilter(COCO_KEYPOINT_COUNT));
  const latestPoseRef = useRef<PoseFrame | null>(null);
  const latestAnglesRef = useRef<ClinicalAngles | null>(null);
  const rvfcHandleRef = useRef<number | null>(null);
  const rafHandleRef = useRef<number | null>(null);
  const submittingRef = useRef(false);
  const onPoseRef = useRef(onPose);
  const onAnglesRef = useRef(onAngles);
  const onStatusRef = useRef(onStatus);
  const drawOverlayRef = useRef(drawOverlay);
  onPoseRef.current = onPose;
  onAnglesRef.current = onAngles;
  onStatusRef.current = onStatus;
  drawOverlayRef.current = drawOverlay;

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [engineStatus, setEngineStatus] = useState('Loading RTMPose…');
  const [isLive, setIsLive] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  const setStatus = useCallback((status: string) => {
    setEngineStatus(status);
    onStatusRef.current?.(status);
  }, []);

  const compositeFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      if (video.videoWidth === 0 || video.videoHeight === 0) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const pose = latestPoseRef.current;
    if (pose) {
      drawSkeleton(ctx, pose.keypoints);
      if (showAngles && latestAnglesRef.current) {
        drawJointAngleLabels(ctx, pose.keypoints, latestAnglesRef.current);
      }
      drawOverlayRef.current?.(ctx, pose);
    }
  }, [showAngles]);

  const submitBitmap = useCallback((video: HTMLVideoElement, mediaTime: number) => {
    const client = clientRef.current;
    if (!client || client.isBusy || submittingRef.current) return;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    submittingRef.current = true;
    void createImageBitmap(video)
      .then((bitmap) => {
        if (!clientRef.current || clientRef.current.isBusy) {
          bitmap.close();
          return;
        }
        clientRef.current.submitFrame(bitmap, mediaTime);
      })
      .catch(() => undefined)
      .finally(() => {
        submittingRef.current = false;
      });
  }, []);

  const stopLoop = useCallback(() => {
    const video = videoRef.current;
    if (video && rvfcHandleRef.current !== null) {
      video.cancelVideoFrameCallback(rvfcHandleRef.current);
    }
    rvfcHandleRef.current = null;
    if (rafHandleRef.current !== null) {
      cancelAnimationFrame(rafHandleRef.current);
      rafHandleRef.current = null;
    }
  }, []);

  const startLoop = useCallback(() => {
    stopLoop();
    const video = videoRef.current;
    if (!video) return;

    const onVideoFrame: VideoFrameCallback = (_now, metadata) => {
      submitBitmap(video, metadata.mediaTime);
      compositeFrame();
      setCurrentTime((prev) => (Math.abs(prev - video.currentTime) >= 0.04 ? video.currentTime : prev));
      rvfcHandleRef.current = video.requestVideoFrameCallback(onVideoFrame);
    };

    if (typeof video.requestVideoFrameCallback === 'function') {
      rvfcHandleRef.current = video.requestVideoFrameCallback(onVideoFrame);
      return;
    }

    const tick = () => {
      submitBitmap(video, video.currentTime);
      compositeFrame();
      setCurrentTime((prev) => (Math.abs(prev - video.currentTime) >= 0.04 ? video.currentTime : prev));
      rafHandleRef.current = requestAnimationFrame(tick);
    };
    rafHandleRef.current = requestAnimationFrame(tick);
  }, [compositeFrame, stopLoop, submitBitmap]);

  useEffect(() => {
    const client = new RtmposeClient({
      variant: modelVariant,
      onReady: ({ executionProvider, inputWidth, inputHeight }) => {
        setStatus(
          `RTMPose-${modelVariant} ready · ${executionProvider} · ${inputWidth}×${inputHeight}`,
        );
      },
      onError: (message) => setStatus(`Pose engine error: ${message}`),
      onPose: (pose) => {
        const timestamp = pose.mediaTime > 0 ? pose.mediaTime : performance.now() / 1000;
        const xs = Float32Array.from(pose.keypoints.map((k) => k.x));
        const ys = Float32Array.from(pose.keypoints.map((k) => k.y));
        const scores = Float32Array.from(pose.keypoints.map((k) => k.score));
        const smoothed = smootherRef.current.apply(xs, ys, scores, timestamp);
        const keypoints = keypointsFromSmooth(smoothed.xs, smoothed.ys, smoothed.scores);
        const filtered: PoseFrame = { ...pose, keypoints };
        latestPoseRef.current = filtered;
        const angles = computeClinicalAngles(keypoints);
        latestAnglesRef.current = angles;
        onPoseRef.current?.(filtered);
        onAnglesRef.current?.(angles);
        compositeFrame();
      },
    });
    clientRef.current = client;
    smootherRef.current.reset();
    setStatus(`Loading RTMPose-${modelVariant}…`);
    void client.start();
    return () => {
      client.stop();
      clientRef.current = null;
    };
  }, [compositeFrame, modelVariant, setStatus]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let objectUrl: string | null = null;
    setVideoReady(false);
    latestPoseRef.current = null;
    smootherRef.current.reset();

    if (mediaStream) {
      video.srcObject = mediaStream;
      video.src = '';
      setIsLive(true);
      setDuration(0);
      void video.play().then(() => {
        setIsPlaying(true);
      });
    } else if (videoFile) {
      video.srcObject = null;
      objectUrl = URL.createObjectURL(videoFile);
      video.src = objectUrl;
      setIsLive(false);
      setIsPlaying(false);
    } else {
      video.srcObject = null;
      video.removeAttribute('src');
      setIsLive(false);
    }

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaStream, videoFile]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoaded = () => {
      setVideoReady(true);
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
      if (video.videoWidth && canvasRef.current) {
        canvasRef.current.width = video.videoWidth;
        canvasRef.current.height = video.videoHeight;
      }
      compositeFrame();
      submitBitmap(video, video.currentTime);
      startLoop();
    };
    const onPlay = () => {
      setIsPlaying(true);
      startLoop();
    };
    const onPause = () => {
      setIsPlaying(false);
      compositeFrame();
    };
    const onSeeked = () => {
      smootherRef.current.reset();
      compositeFrame();
      submitBitmap(video, video.currentTime);
    };
    const onEnded = () => {
      setIsPlaying(false);
    };

    video.addEventListener('loadeddata', onLoaded);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('loadeddata', onLoaded);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('ended', onEnded);
      stopLoop();
    };
  }, [compositeFrame, startLoop, stopLoop, submitBitmap, videoFile, mediaStream]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || isLive) return;
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  };

  const onScrub = (value: number) => {
    const video = videoRef.current;
    if (!video || isLive) return;
    video.currentTime = value;
    setCurrentTime(value);
  };

  const toggleFullscreen = () => {
    const node = wrapperRef.current;
    if (!node) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void node.requestFullscreen();
    }
  };

  const visible = videoReady || !!videoFile || !!mediaStream;
  const frameLabel = isLive
    ? 'Live camera'
    : `Time ${currentTime.toFixed(2)}s / ${duration.toFixed(2)}s`;

  return (
    <div className={`video-wrapper ${visible ? 'visible' : ''}`} ref={wrapperRef}>
      <video ref={videoRef} className="hidden-video" muted playsInline />
      <div className="canvas-container">
        <canvas ref={canvasRef} />
        {visible && (
          <div className="controls-overlay">
            <div className={`tool-widget ${toolsOpen ? 'active' : ''}`}>
              <button
                className="tool-widget-toggle"
                type="button"
                onClick={() => setToolsOpen((open) => !open)}
                title="Session info"
              >
                ⚙
              </button>
              <div className="toolbar">
                <p className="engine-status">{engineStatus}</p>
              </div>
            </div>

            <button
              className="icon-btn fullscreen-icon-btn"
              type="button"
              onClick={toggleFullscreen}
              title="Fullscreen"
            >
              ⛶
            </button>

            <div className="bottom-controls">
              {!isLive && (
                <div className="play-pause-container">
                  <button className="icon-btn" type="button" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                </div>
              )}
              <div className="slider-container">
                <div className="frame-info">{frameLabel}</div>
                {!isLive && (
                  <input
                    className="bar-slider"
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.01}
                    value={Math.min(currentTime, duration || 0)}
                    onChange={(event) => onScrub(Number(event.target.value))}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

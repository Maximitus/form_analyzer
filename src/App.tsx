import { useCallback, useEffect, useRef, useState, type ChangeEventHandler } from 'react';
import { PoseTracker } from './components/PoseTracker';
import { AnglePanel } from './components/AnglePanel';
import {
  drawGolfFrontalOverlay,
  GolfPanel,
  GolfSession,
  type GolfFrontalMetrics,
  type GolfHandedness,
} from './modules/golf';
import type { ClinicalAngles, PoseFrame, RtmposeVariant } from './types/pose';
import './App.css';

type AnalysisModule = 'clinical' | 'golf';

export default function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [angles, setAngles] = useState<ClinicalAngles | null>(null);
  const [golfMetrics, setGolfMetrics] = useState<GolfFrontalMetrics | null>(null);
  const [variant, setVariant] = useState<RtmposeVariant>('s');
  const [module, setModule] = useState<AnalysisModule>('golf');
  const [handedness, setHandedness] = useState<GolfHandedness>('right');
  const [status, setStatus] = useState('Idle');
  const [error, setError] = useState<string | null>(null);

  const golfSessionRef = useRef(new GolfSession('right'));
  const golfMetricsRef = useRef<GolfFrontalMetrics | null>(null);

  const stopStream = useCallback(() => {
    setStream((current) => {
      current?.getTracks().forEach((track) => track.stop());
      return null;
    });
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  useEffect(() => {
    golfSessionRef.current.setHandedness(handedness);
    setGolfMetrics(null);
    golfMetricsRef.current = null;
  }, [handedness]);

  useEffect(() => {
    golfSessionRef.current.reset();
    setGolfMetrics(null);
    golfMetricsRef.current = null;
  }, [videoFile, stream, module]);

  const onUpload: ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0] ?? null;
    stopStream();
    setVideoFile(file);
    setAngles(null);
    setError(null);
  };

  const startCamera = async () => {
    setError(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setVideoFile(null);
      setStream(media);
      setAngles(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Camera permission denied';
      setError(message);
    }
  };

  const onPose = useCallback(
    (pose: PoseFrame) => {
      if (module !== 'golf') return;
      const next = golfSessionRef.current.update(pose.keypoints, pose.clubHead, pose.mediaTime);
      golfMetricsRef.current = next;
      setGolfMetrics(next);
    },
    [module],
  );

  const drawOverlay = useCallback(
    (ctx: CanvasRenderingContext2D, pose: PoseFrame) => {
      if (module !== 'golf') return;
      drawGolfFrontalOverlay(ctx, pose.keypoints, golfMetricsRef.current);
    },
    [module],
  );

  return (
    <div className="page">
      <div className="container">
        <h1>Form Analyzer</h1>
        <p className="lede">
          Real-time physical therapy analysis with RTMPose (SimCC, 17 COCO keypoints) running
          in ONNX Runtime Web.
        </p>

        <div className="upload-section">
          <input id="videoInput" type="file" accept="video/*" onChange={onUpload} />
          <label htmlFor="videoInput" className="upload-btn">
            Upload video
          </label>
          <button className="upload-btn secondary" type="button" onClick={startCamera}>
            Use camera
          </button>
          <label className="model-picker">
            Module
            <select
              value={module}
              onChange={(event) => setModule(event.target.value as AnalysisModule)}
            >
              <option value="golf">Golf · face-on (frontal)</option>
              <option value="clinical">General PT angles</option>
            </select>
          </label>
          {module === 'golf' && (
            <label className="model-picker">
              Handedness
              <select
                value={handedness}
                onChange={(event) => setHandedness(event.target.value as GolfHandedness)}
              >
                <option value="right">Right-handed</option>
                <option value="left">Left-handed</option>
              </select>
            </label>
          )}
          <label className="model-picker">
            Model
            <select
              value={variant}
              onChange={(event) => setVariant(event.target.value as RtmposeVariant)}
            >
              <option value="s">RTMPose-s (256×192)</option>
              <option value="m">RTMPose-m (256×192)</option>
            </select>
          </label>
          <p className="hint">
            {module === 'golf'
              ? 'Film from in front of the player (face-on). That is the frontal / coronal plane in PT — anterior view.'
              : 'Upload a sagittal or frontal clip, or open the camera. Pose runs fully on-device.'}
          </p>
          {error && <p className="error">{error}</p>}
          <p className="hint status-line">{status}</p>
        </div>

        <PoseTracker
          videoFile={videoFile}
          mediaStream={stream}
          modelVariant={variant}
          showAngles={module === 'clinical'}
          onAngles={setAngles}
          onPose={onPose}
          onStatus={setStatus}
          drawOverlay={drawOverlay}
          trackClubHead={module === 'golf'}
          leadIsLeft={handedness === 'right'}
        />

        <div className="panels">
          {module === 'golf' ? <GolfPanel metrics={golfMetrics} /> : <AnglePanel angles={angles} />}
          <div className="info-panel">
            <h3>{module === 'golf' ? 'Face-on checklist' : 'How it works'}</h3>
            {module === 'golf' ? (
              <ul>
                <li>
                  Camera on the target line, looking at the sternum — golf <em>face-on</em>, PT{' '}
                  <em>frontal plane</em>.
                </li>
                <li>White dashed line is the ankle midline. Cyan = shoulders, gold = pelvis. Yellow = club head.</li>
                <li>Hold setup for a moment so address can calibrate sway.</li>
                <li>
                  Club head is tracked along the shaft from the trail hand — not a COCO keypoint. Expect dropouts
                  on a blurred downswing; address is the reliable lock.
                </li>
                <li>Side-on / down-the-line (sagittal) is a different module — this one will not see early extension well.</li>
              </ul>
            ) : (
              <ul>
                <li>
                  Each video frame is captured with <code>requestVideoFrameCallback</code> and
                  transferred as an <code>ImageBitmap</code> to the RTMPose worker.
                </li>
                <li>
                  The same canvas composites the matching video frame, a One-Euro-smoothed skeleton,
                  and clinical hip / knee / ankle / trunk angles.
                </li>
                <li>Inference uses WebGPU when available, with WASM as fallback.</li>
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

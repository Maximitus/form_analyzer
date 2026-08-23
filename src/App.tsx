import { useCallback, useEffect, useState, type ChangeEventHandler } from 'react';
import { PoseTracker } from './components/PoseTracker';
import { AnglePanel } from './components/AnglePanel';
import type { ClinicalAngles, RtmposeVariant } from './types/pose';
import './App.css';

export default function App() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [angles, setAngles] = useState<ClinicalAngles | null>(null);
  const [variant, setVariant] = useState<RtmposeVariant>('s');
  const [status, setStatus] = useState('Idle');
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    setStream((current) => {
      current?.getTracks().forEach((track) => track.stop());
      return null;
    });
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

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
            Upload a sagittal or frontal clip, or open the camera. Pose runs fully on-device in a
            Web Worker — no MediaPipe / BlazePose.
          </p>
          {error && <p className="error">{error}</p>}
          <p className="hint status-line">{status}</p>
        </div>

        <PoseTracker
          videoFile={videoFile}
          mediaStream={stream}
          modelVariant={variant}
          onAngles={setAngles}
          onStatus={setStatus}
        />

        <div className="panels">
          <AnglePanel angles={angles} />
          <div className="info-panel">
            <h3>How it works</h3>
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
          </div>
        </div>
      </div>
    </div>
  );
}

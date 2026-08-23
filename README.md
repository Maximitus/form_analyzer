<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/9058c3aa-868d-488b-b143-ce430df61026

Analysis modes: **Stride**, **Squat**, and **Golf**. Golf supports face-on (frontal / anterior) and down-the-line (sagittal) camera views, plus a wrist-guided club-head search (pose models only output body landmarks). Pose uses **ONNX Runtime Web + RTMPose** in a worker (not BlazePose). Heel/toe overlays stay empty because RTMPose is COCO-17.

Cloudflare Workers/Pages project name: **`form-analyzer`**. It is connected to **`Maximitus/Form-Analyzer` `main`** (a bot commit on `cloudflare/workers-autoconfig` only added `wrangler.jsonc`). Commits to `Maximitus/form_analyzer` (underscore) do not update https://maxmvs.com/formanalyzer/.

To put Golf + RTMPose on the live site, copy this branch onto **`Maximitus/Form-Analyzer` `main`** and push:

```bash
git clone https://github.com/Maximitus/Form-Analyzer.git
cd Form-Analyzer
git fetch https://github.com/Maximitus/form_analyzer.git cursor/golf-module-705b:golf-snapshot
git checkout golf-snapshot -- .
git add -A && git commit -m "Add Golf mode and replace BlazePose with RTMPose"
git push origin main
```

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

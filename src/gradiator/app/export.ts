import { downloadBlob, downloadCanvasAsPng } from "../render-engine";
import type { AppConstructor } from "./mixin";

const VIDEO_EXPORT_DURATION_MS = 5000;
const VIDEO_EXPORT_FPS = 60;
const VIDEO_EXPORT_BITS_PER_SECOND = 8_000_000;
const VIDEO_EXPORT_MIME_TYPES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4;codecs=h264",
  "video/mp4",
];

function getSupportedVideoMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return VIDEO_EXPORT_MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}

function getVideoFileExtension(mimeType: string) {
  return mimeType.startsWith("video/mp4") ? "mp4" : "webm";
}

export function withExport<TBase extends AppConstructor<any>>(Base: TBase) {
  return class GradiatorExportApp extends Base {
    exportPng() {
      this.refreshDisplayGrid(this.animatePoints ? performance.now() : this.animationTimeMs);
      this.renderGL(this.SUBS_HI, this.getDisplayGrid());
      downloadCanvasAsPng(this.glCanvas);
    }

    exportVideo() {
      if (this.isExportingVideo) return;

      const mimeType = getSupportedVideoMimeType();
      if (!mimeType || typeof this.glCanvas.captureStream !== "function") {
        window.alert("Video export is not supported in this browser. Exporting a PNG instead.");
        this.exportPng();
        return;
      }

      this.exportVideoChunks = [];
      this.exportVideoMimeType = mimeType;
      this.shouldDownloadVideoExport = true;
      this.isExportingVideo = true;
      this.updateExportButtonState();
      this.refreshDisplayGrid(performance.now());
      this.renderGL(this.SUBS_HI, this.getDisplayGrid());

      try {
        this.exportVideoStream = this.glCanvas.captureStream(VIDEO_EXPORT_FPS);
        this.exportVideoRecorder = new MediaRecorder(this.exportVideoStream, {
          mimeType,
          videoBitsPerSecond: VIDEO_EXPORT_BITS_PER_SECOND,
        });
      } catch (error) {
        console.warn("Failed to start video export", error);
        this.cleanupVideoExport();
        window.alert("Video export could not start. Exporting a PNG instead.");
        this.exportPng();
        return;
      }

      this.exportVideoRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.exportVideoChunks.push(event.data);
      };
      this.exportVideoRecorder.onerror = (event) => {
        console.warn("Video export failed", event);
        this.shouldDownloadVideoExport = false;
        this.stopVideoExport();
        window.alert("Video export failed. Exporting a PNG instead.");
        this.exportPng();
      };
      this.exportVideoRecorder.onstop = () => {
        this.finalizeVideoExport();
      };

      try {
        this.exportVideoRecorder.start(250);
      } catch (error) {
        console.warn("Failed to start video export", error);
        this.cleanupVideoExport();
        window.alert("Video export could not start. Exporting a PNG instead.");
        this.exportPng();
        return;
      }

      this.exportVideoTimer = window.setTimeout(() => {
        this.stopVideoExport();
      }, VIDEO_EXPORT_DURATION_MS);
    }

    stopVideoExport() {
      if (this.exportVideoTimer !== null) {
        window.clearTimeout(this.exportVideoTimer);
        this.exportVideoTimer = null;
      }

      if (this.exportVideoRecorder && this.exportVideoRecorder.state !== "inactive") {
        this.exportVideoRecorder.stop();
        return;
      }

      this.finalizeVideoExport();
    }

    cancelVideoExport() {
      if (!this.isExportingVideo) return;
      this.shouldDownloadVideoExport = false;
      this.stopVideoExport();
    }

    finalizeVideoExport() {
      const shouldDownload = this.shouldDownloadVideoExport;
      const chunks = [...this.exportVideoChunks];
      const mimeType = this.exportVideoMimeType;
      this.cleanupVideoExport();

      if (!shouldDownload) return;
      if (!chunks.length) {
        window.alert("Video export did not produce any frames. Exporting a PNG instead.");
        this.exportPng();
        return;
      }

      const blob = new Blob(chunks, { type: mimeType });
      downloadBlob(blob, `gradient-animation.${getVideoFileExtension(mimeType)}`);
    }

    cleanupVideoExport() {
      if (this.exportVideoTimer !== null) {
        window.clearTimeout(this.exportVideoTimer);
        this.exportVideoTimer = null;
      }
      this.exportVideoStream?.getTracks().forEach((track) => track.stop());
      this.exportVideoRecorder = null;
      this.exportVideoStream = null;
      this.exportVideoChunks = [];
      this.exportVideoMimeType = "";
      this.shouldDownloadVideoExport = false;
      this.isExportingVideo = false;
      this.updateExportButtonState();
    }
  };
}

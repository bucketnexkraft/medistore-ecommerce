const SUPPORTED_FORMATS = [
  "code_128",
  "code_39",
  "code_93",
  "codabar",
  "ean_13",
  "ean_8",
  "itf",
  "upc_a",
  "upc_e",
];

const state = {
  detector: null,
  video: null,
  intervalId: null,
  detectedHandler: null,
  running: false,
};

const resetScanner = () => {
  if (state.intervalId) {
    window.clearInterval(state.intervalId);
    state.intervalId = null;
  }
  state.running = false;
};

const detectCode = async () => {
  if (!state.running || !state.detector || !state.video) return;

  try {
    if (state.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    const results = await state.detector.detect(state.video);
    const barcode = results.find((item) => item?.rawValue);

    if (barcode?.rawValue && state.detectedHandler) {
      resetScanner();
      state.detectedHandler({
        codeResult: { code: barcode.rawValue },
        rawResult: barcode,
      });
    }
  } catch (error) {
    console.error("Barcode detection error:", error);
  }
};

const QuaggaShim = {
  init(config, callback) {
    resetScanner();
    state.video = config?.inputStream?.target || null;

    try {
      if (typeof window === "undefined" || typeof window.BarcodeDetector !== "function") {
        throw new Error("Barcode scanning is not supported in this browser.");
      }

      if (!(state.video instanceof HTMLVideoElement)) {
        throw new Error("Camera video target not found.");
      }

      state.detector = new window.BarcodeDetector({ formats: SUPPORTED_FORMATS });
      callback?.(null);
    } catch (error) {
      state.detector = null;
      callback?.(error);
    }
  },

  start() {
    if (!state.detector || state.running) return;
    state.running = true;
    state.intervalId = window.setInterval(() => {
      void detectCode();
    }, 400);
    void detectCode();
  },

  stop() {
    resetScanner();
  },

  onDetected(handler) {
    state.detectedHandler = handler;
  },

  offDetected() {
    state.detectedHandler = null;
  },

  offProcessed() {},
};

export default QuaggaShim;

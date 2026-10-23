import { type DragEvent, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  Image as ImageIcon,
  Info,
  Leaf,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";

const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000")
  .trim()
  .replace(/\/+$/, "");
const SUPPORTED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const VALID_CLASSES = ["Early Blight", "Late Blight", "Healthy"] as const;

type PredictionClass = (typeof VALID_CLASSES)[number];
type Prediction = {
  class: PredictionClass;
  confidence: number;
};
type Result = Prediction & { imageUrl: string };
type Notice = { kind: "success" | "error"; message: string } | null;

const classDetails: Record<
  PredictionClass,
  { tone: string; label: string; guidance: string }
> = {
  Healthy: {
    tone: "healthy",
    label: "No blight detected",
    guidance:
      "The model did not detect either configured blight class in this image. Continue checking your plants as they grow.",
  },
  "Early Blight": {
    tone: "early",
    label: "Early blight indicators",
    guidance:
      "Inspect affected leaves, remove badly affected foliage where appropriate, and avoid prolonged leaf wetness.",
  },
  "Late Blight": {
    tone: "late",
    label: "Late blight indicators",
    guidance:
      "Isolate affected plants when practical, remove severely affected material safely, and seek locally appropriate plant disease management guidance.",
  },
};

async function readErrorMessage(response: Response): Promise<string> {
  const fallback =
    response.status >= 500
      ? "The analysis service encountered an error. Please try again shortly."
      : `The analysis request could not be completed (HTTP ${response.status}).`;
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "detail" in body &&
      typeof body.detail === "string"
    ) {
      return body.detail;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

async function readPrediction(response: Response): Promise<Prediction> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("The server returned an unreadable response. Please try again.");
  }
  return parsePrediction(body);
}

function parsePrediction(value: unknown): Prediction {
  if (typeof value !== "object" || value === null) {
    throw new Error("The server returned an unexpected response. Please try again.");
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.class !== "string" ||
    !VALID_CLASSES.includes(candidate.class as PredictionClass) ||
    typeof candidate.confidence !== "number" ||
    !Number.isFinite(candidate.confidence) ||
    candidate.confidence < 0 ||
    candidate.confidence > 1
  ) {
    throw new Error(
      "The server response did not contain a valid class and confidence score.",
    );
  }

  return {
    class: candidate.class as PredictionClass,
    confidence: candidate.confidence,
  };
}

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function chooseFile(file: File | undefined) {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setResult(null);
      setNotice({
        kind: "error",
        message: "That file type is not supported. Choose a JPG, JPEG, PNG, or WEBP image.",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.type && !file.type.startsWith("image/")) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setResult(null);
      setNotice({
        kind: "error",
        message: "This file does not appear to be an image. Choose a JPG, PNG, or WEBP image.",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setPreviewError(false);
    setResult(null);
    setNotice({ kind: "success", message: "Image ready. You can start the analysis." });
  }

  function clearSelection() {
    setSelectedFile(null);
    setPreviewUrl(null);
    setPreviewError(false);
    setResult(null);
    setNotice(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function analyzePlant() {
    if (!selectedFile || !previewUrl || isLoading) return;
    setIsLoading(true);
    setNotice(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`${API_URL}/predict`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const prediction = await readPrediction(response);
      setResult({ ...prediction, imageUrl: previewUrl });
      setNotice({
        kind: "success",
        message: "Analysis complete. Review the result below.",
      });
    } catch (error) {
      const message =
        error instanceof TypeError
          ? "We could not reach the analysis service. Check that the backend is running, then try again."
          : error instanceof Error
            ? error.message
            : "Something went wrong while analyzing this image. Please try again.";
      setNotice({ kind: "error", message });
    } finally {
      setIsLoading(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  }

  const details = result ? classDetails[result.class] : null;
  const confidencePercent = result ? result.confidence * 100 : 0;

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#" aria-label="PlantCare AI home">
          <span className="brand-mark">
            <Leaf size={23} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span className="brand-name">PlantCare <span>AI</span></span>
        </a>
        <div className="header-note">
          <span className="online-dot" aria-hidden="true" />
          CNN-powered plant health check
        </div>
      </header>

      <main>
        <section className="hero" aria-labelledby="page-title">
          <div className="hero-copy">
            <div className="eyebrow"><Sparkles size={14} /> A little more care, backed by AI</div>
            <h1 id="page-title">Healthier plants<br /><span>start with a closer look.</span></h1>
            <p className="hero-description">
              Upload a potato leaf photo and get a quick check for common signs of blight.
            </p>
          </div>
          <div className="hero-illustration" aria-hidden="true">
            <div className="illustration-ring ring-one" />
            <div className="illustration-ring ring-two" />
            <div className="illustration-leaf leaf-back"><Leaf /></div>
            <div className="illustration-leaf leaf-front"><Leaf /></div>
            <span className="illustration-spark spark-one">✳</span>
            <span className="illustration-spark spark-two">✧</span>
          </div>
        </section>

        <section className="workspace" aria-label="Plant image analysis">
          <div className="panel upload-panel">
            <div className="panel-heading">
              <div>
                <span className="step-label">STEP 01</span>
                <h2>Add a leaf photo</h2>
                <p>Choose a clear, well-lit image to get started.</p>
              </div>
              <span className="heading-icon"><ImageIcon size={19} /></span>
            </div>

            <label
              className={`drop-zone${dragging ? " is-dragging" : ""}${previewUrl ? " has-preview" : ""}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setDragging(false);
                }
              }}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                className="visually-hidden"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={(event) => chooseFile(event.target.files?.[0])}
                aria-label="Choose a plant image"
              />
              {previewUrl ? (
                <>
                  {previewError ? (
                    <div className="preview-invalid">
                      <ImageIcon size={30} />
                      <strong>Couldn’t preview this image</strong>
                      <span>Try another image file.</span>
                    </div>
                  ) : (
                    <img
                      className="image-preview"
                      src={previewUrl}
                      alt="Preview of the selected plant leaf"
                      onError={() => setPreviewError(true)}
                    />
                  )}
                  <span className="preview-overlay">
                    <span className="preview-file"><Check size={14} /> {selectedFile?.name}</span>
                    <span className="replace-hint">Click to replace</span>
                  </span>
                </>
              ) : (
                <div className="upload-prompt">
                  <span className="upload-icon"><Upload size={21} /></span>
                  <strong>Drop your image here</strong>
                  <span className="upload-or">or <span>browse files</span> on your device</span>
                  <span className="file-types" id="file-types">JPG, JPEG, PNG or WEBP</span>
                </div>
              )}
            </label>

            <div className="upload-footer">
              <span><ShieldCheck size={15} /> Your image stays private</span>
              {selectedFile && (
                <button className="text-button" type="button" onClick={clearSelection}>
                  Remove image
                </button>
              )}
            </div>

            {notice && (
              <div
                className={`notice ${notice.kind}`}
                role={notice.kind === "error" ? "alert" : "status"}
                aria-live={notice.kind === "error" ? "assertive" : "polite"}
              >
                {notice.kind === "error" ? <Info size={17} /> : <CheckCircle2 size={17} />}
                <span>{notice.message}</span>
              </div>
            )}

            <button
              className="analyze-button"
              type="button"
              disabled={!selectedFile || isLoading || previewError}
              onClick={analyzePlant}
            >
              {isLoading ? (
                <><LoaderCircle className="spin" size={19} /> Analyzing your image…</>
              ) : (
                <>Analyze Plant <ArrowRight size={18} /></>
              )}
            </button>
            <p className="button-caption">Usually takes just a few seconds</p>
          </div>

          <div className="panel result-panel" aria-live="polite">
            <div className="panel-heading result-heading">
              <div>
                <span className="step-label">STEP 02</span>
                <h2>Your plant’s health</h2>
                <p>AI-assisted results from your image.</p>
              </div>
              {result && (
                <span className={`status-icon ${details?.tone}`}>
                  {result.class === "Healthy" ? <CheckCircle2 size={20} /> : <Activity size={20} />}
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="result-empty loading-state">
                <span className="loading-orbit"><LoaderCircle className="spin" size={28} /></span>
                <strong>Taking a closer look</strong>
                <p>Checking leaf patterns against the model.</p>
              </div>
            ) : result && details ? (
              <div className="result-content">
                <div className={`diagnosis-banner ${details.tone}`}>
                  <div className="diagnosis-symbol">
                    {result.class === "Healthy" ? <CheckCircle2 size={22} /> : <Activity size={22} />}
                  </div>
                  <div className="diagnosis-copy">
                    <span>{details.label}</span>
                    <strong>{result.class}</strong>
                  </div>
                  <span className="result-check"><Check size={15} /></span>
                </div>

                <div className="confidence-block">
                  <div className="confidence-label">
                    <span>Model confidence</span>
                    <strong>{confidencePercent.toFixed(1)}%</strong>
                  </div>
                  <div
                    className="confidence-track"
                    role="progressbar"
                    aria-label="Model confidence"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Number(confidencePercent.toFixed(1))}
                  >
                    <span className={`confidence-fill ${details.tone}`} style={{ width: `${confidencePercent}%` }} />
                  </div>
                  <p>How strongly the model matched this image to its prediction.</p>
                </div>

                <div className="guidance">
                  <span className="guidance-icon"><Leaf size={16} /></span>
                  <p>{details.guidance}</p>
                </div>

                <div className="result-image-row">
                  <img src={result.imageUrl} alt="Analyzed plant leaf" />
                  <div>
                    <span>IMAGE ANALYZED</span>
                    <strong>{selectedFile?.name ?? "Plant image"}</strong>
                  </div>
                  <CheckCircle2 size={17} />
                </div>
                <p className="disclaimer"><Info size={13} /> This is an AI estimate, not a guaranteed diagnosis. Results depend on image quality and model accuracy.</p>
              </div>
            ) : (
              <div className="result-empty">
                <div className="empty-art">
                  <span className="empty-circle"><Leaf size={27} /></span>
                  <span className="empty-spark spark-a">✧</span>
                  <span className="empty-spark spark-b">✳</span>
                </div>
                <strong>Your results will appear here</strong>
                <p>Upload a clear photo of a potato leaf, then select <b>Analyze Plant</b> to see its health check.</p>
                <div className="empty-steps">
                  <span><i>1</i> Add a photo</span>
                  <ArrowRight size={14} />
                  <span><i>2</i> Get insights</span>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="reassurance" aria-label="About this analysis">
          <div className="reassurance-item">
            <span className="reassurance-icon"><Activity size={17} /></span>
            <div><strong>Focused detection</strong><span>Early blight, late blight &amp; healthy leaves</span></div>
          </div>
          <span className="reassurance-divider" />
          <div className="reassurance-item">
            <span className="reassurance-icon"><ShieldCheck size={17} /></span>
            <div><strong>A helpful first check</strong><span>Use results as a guide, not a diagnosis</span></div>
          </div>
          <button
            type="button"
            className="start-over"
            onClick={() => {
              clearSelection();
              fileInputRef.current?.click();
            }}
          >
            <RotateCcw size={15} /> Start over
          </button>
        </section>
      </main>

      <footer className="site-footer">
        <a className="footer-brand" href="#"><Leaf size={16} /> PlantCare AI</a>
        <span>PlantCare AI <i>•</i> CNN-Based Plant Health Classification</span>
        <span className="footer-note">A thoughtful tool for healthier growing</span>
      </footer>
    </div>
  );
}

export default App;

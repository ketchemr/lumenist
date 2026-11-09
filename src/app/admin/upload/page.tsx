"use client";

import { useState, useEffect, useRef } from "react";
import exifr from "exifr";
import Link from "next/link";
import {
  Upload,
  Camera,
  MapPin,
  Tag,
  Folder,
  CheckCircle2,
  Lock,
  LogOut,
  Sparkles,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { AdminMapPicker } from "@/components/AdminMapPicker";
import { Breadcrumbs } from "@/components/Breadcrumbs";

const KNOWN_CATEGORIES = [
  "Water",
  "Trees",
  "Mountains",
  "Sunsets",
  "Coast",
  "Fall Color",
  "Wildlife",
  "Trails",
  "Black and White",
  "Birds",
  "Winter",
  "Waterfalls",
  "Mountain Loop Highway",
  "Abstract",
  "Clouds",
  "Macro",
  "Panoramic",
  "Favorites",
  "Hawaii",
  "Hot Air Balloons",
  "Plants",
  "Sunrise",
  "Infrared",
  "Mount Shuksan",
];

const TRIPOD_OPTIONS = [
  "None",
  "Manfrotto Befree GT XPRO Carbon, 496 ball head",
  "Gitzo",
  "Tabletop / Monopod",
];

export default function AdminUploadPage() {
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Upload & File states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Form & EXIF states
  const [photoID, setPhotoID] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [captureDate, setCaptureDate] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [tripod, setTripod] = useState(TRIPOD_OPTIONS[0]);
  const [availability, setAvailability] = useState("Available for Order");

  // Detected technical details
  const [detectedCamera, setDetectedCamera] = useState<any>(null);

  // Submission states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [publishedResult, setPublishedResult] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check auth on mount
  useEffect(() => {
    fetch("/api/admin/auth")
      .then((res) => res.json())
      .then((data) => {
        setIsAuthenticated(!!data.authenticated);
      })
      .catch(() => {
        setIsAuthenticated(false);
      });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError("");

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        setPasswordInput("");
      } else {
        setAuthError(data.error || "Incorrect password");
      }
    } catch {
      setAuthError("Network error during login");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    setIsAuthenticated(false);
  };

  // Process dropped or selected image file
  const handleFileSelect = async (file: File) => {
    if (!file.type.includes("jpeg") && !file.type.includes("jpg")) {
      alert("Please upload a JPEG photograph (.jpg or .jpeg)");
      return;
    }

    setSelectedFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setSubmitError("");
    setPublishedResult(null);

    // Extract EXIF in browser
    try {
      const exif = await exifr.parse(file, {
        tiff: true,
        xmp: true,
        gps: true,
      });

      if (exif) {
        // Date
        const dateObj: Date | undefined = exif.DateTimeOriginal || exif.CreateDate;
        const now = dateObj instanceof Date && !isNaN(dateObj.getTime()) ? dateObj : new Date();

        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const hour = String(now.getHours()).padStart(2, "0");
        const minute = String(now.getMinutes()).padStart(2, "0");
        const second = String(now.getSeconds()).padStart(2, "0");

        setCaptureDate(`${year}-${month}-${day}T${hour}:${minute}:${second}`);

        // Default PhotoID matching dYYYYMMDDHHMMSS format
        const generatedId = `d${year}${month}${day}${hour}${minute}${second}`;
        setPhotoID(generatedId);

        // Coordinates
        if (exif.latitude !== undefined && exif.longitude !== undefined) {
          setLatitude(parseFloat(exif.latitude.toFixed(6)));
          setLongitude(parseFloat(exif.longitude.toFixed(6)));
        }

        // Camera Details
        setDetectedCamera({
          make: exif.Make,
          model: exif.Model,
          lens: exif.LensModel || exif.Lens,
          focalLength: exif.FocalLength ? `${Math.round(exif.FocalLength)} mm` : undefined,
          shutter: exif.ExposureTime
            ? exif.ExposureTime >= 1
              ? `${exif.ExposureTime}s`
              : `1/${Math.round(1 / exif.ExposureTime)} ss`
            : undefined,
          aperture: exif.FNumber ? `f${exif.FNumber}` : undefined,
          iso: exif.ISO ? `ISO ${exif.ISO}` : undefined,
          exposureComp: exif.ExposureCompensation !== undefined ? `${exif.ExposureCompensation} Ev` : undefined,
          whiteBalance: exif.WhiteBalance || "Auto",
        });

        // Set initial title from file name if cleanly named
        const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/_desktop|_original/i, "");
        if (!baseName.startsWith("d20") && !baseName.startsWith("s00")) {
          setTitle(baseName.replace(/[-_]/g, " "));
        }
      }
    } catch (err) {
      console.warn("Could not read EXIF:", err);
    }
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const addCustomCategory = () => {
    const trimmed = newCategoryInput.trim();
    if (trimmed && !selectedCategories.includes(trimmed)) {
      setSelectedCategories((prev) => [...prev, trimmed]);
      setNewCategoryInput("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setSubmitError("Please choose a photograph to upload");
      return;
    }
    if (!title.trim()) {
      setSubmitError("Please provide a photograph title");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("photoID", photoID.trim());
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append("albums", selectedCategories.join(","));
    formData.append("tags", tagsInput.trim());
    formData.append("tripod", tripod);
    formData.append("availability", availability);

    if (captureDate) {
      const d = new Date(captureDate);
      if (!isNaN(d.getTime())) {
        formData.append("year", String(d.getFullYear()));
        formData.append("month", String(d.getMonth() + 1));
        formData.append("day", String(d.getDate()));
        formData.append("hour", String(d.getHours()));
        formData.append("minute", String(d.getMinutes()));
        formData.append("second", String(d.getSeconds()));
      }
    }

    if (latitude !== null && longitude !== null) {
      formData.append("latitude", String(latitude));
      formData.append("longitude", String(longitude));
    }

    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPublishedResult(data);
      } else {
        setSubmitError(data.error || "Failed to publish photo");
      }
    } catch {
      setSubmitError("Network error occurred while uploading");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setImagePreviewUrl(null);
    setPhotoID("");
    setTitle("");
    setDescription("");
    setLatitude(null);
    setLongitude(null);
    setSelectedCategories([]);
    setTagsInput("");
    setTripod(TRIPOD_OPTIONS[0]);
    setDetectedCamera(null);
    setPublishedResult(null);
    setSubmitError("");
  };

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="py-24 text-center text-muted font-mono text-xs">
        Checking admin authentication...
      </div>
    );
  }

  // 1. Password Login View
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-full bg-surface border border-surface-border text-accent mb-2">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-light text-white tracking-tight">
            Lumenist Admin
          </h1>
          <p className="text-xs text-muted">
            Enter your admin passphrase to manage and publish photographs.
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-surface border border-surface-border rounded-sm p-6 space-y-4 shadow-xl"
        >
          <div>
            <label className="block text-xs text-gray-300 font-medium mb-1.5">
              Admin Password
            </label>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full bg-black border border-surface-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
            />
          </div>

          {authError && (
            <p className="text-xs text-red-400 font-medium">{authError}</p>
          )}

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full bg-accent hover:bg-accent-light text-black font-semibold text-xs py-2.5 rounded transition-colors cursor-pointer"
          >
            {isLoggingIn ? "Verifying..." : "Sign In to Admin"}
          </button>
        </form>
      </div>
    );
  }

  // 2. Celebratory Success Screen
  if (publishedResult) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 space-y-8 text-center">
        <div className="inline-flex p-4 rounded-full bg-green-500/10 border border-green-500/30 text-green-400">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-light text-white tracking-tight">
            Photograph Published!
          </h1>
          <p className="text-sm text-gray-400 max-w-md mx-auto">
            &ldquo;{publishedResult.photo?.title}&rdquo; is now live in your gallery.
            The image and companion .txt file have been saved to disk.
          </p>
        </div>

        {imagePreviewUrl && (
          <div className="max-w-md mx-auto rounded-sm overflow-hidden border border-surface-border bg-black shadow-2xl p-2">
            <img
              src={imagePreviewUrl}
              alt={publishedResult.photo?.title}
              className="w-full h-auto max-h-80 object-contain rounded"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            href={publishedResult.url}
            className="inline-flex items-center space-x-2 bg-accent hover:bg-accent-light text-black font-semibold text-xs px-5 py-2.5 rounded transition-colors"
          >
            <span>View Photograph Live in Gallery</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center space-x-2 bg-surface hover:bg-surface-hover border border-surface-border text-white text-xs px-5 py-2.5 rounded transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Another Photograph</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Main Admin Upload Interface
  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-surface-border pb-4">
        <Breadcrumbs items={[{ label: "Admin" }, { label: "Photo Uploader" }]} />

        <button
          onClick={handleLogout}
          className="inline-flex items-center space-x-1.5 text-xs text-muted hover:text-white transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Log Out</span>
        </button>
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-light text-white tracking-tight">
          Publish New Photograph
        </h1>
        <p className="text-xs text-muted">
          Drop a high-resolution JPEG. EXIF technical parameters are automatically extracted and written to disk with your companion .txt metadata.
        </p>
      </div>

      {/* Drag & Drop Zone */}
      {!selectedFile ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files?.[0]) {
              handleFileSelect(e.dataTransfer.files[0]);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-sm p-12 text-center transition-all cursor-pointer ${
            isDragging
              ? "border-accent bg-accent/5 scale-[1.01]"
              : "border-surface-border bg-surface/50 hover:bg-surface hover:border-gray-500"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept="image/jpeg,image/jpg"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleFileSelect(e.target.files[0]);
              }
            }}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-4 rounded-full bg-surface border border-surface-border text-accent">
              <Upload className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">
                Drag and drop your JPEG photograph here
              </p>
              <p className="text-xs text-muted">
                or click to browse from your computer (.jpg / .jpeg)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Image Preview & Detected EXIF */}
            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-sm overflow-hidden border border-surface-border bg-black shadow-xl relative group">
                <img
                  src={imagePreviewUrl!}
                  alt="Preview"
                  className="w-full h-auto max-h-96 object-contain mx-auto"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-2 right-2 text-xs bg-black/80 hover:bg-black text-white px-2.5 py-1 rounded border border-white/20 transition-colors"
                >
                  Change File
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/jpeg,image/jpg"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
              </div>

              {/* Detected EXIF Badge Box */}
              {detectedCamera && (
                <div className="bg-surface border border-surface-border rounded-sm p-4 space-y-3">
                  <div className="flex items-center space-x-2 text-white font-medium text-xs border-b border-surface-border pb-2">
                    <Camera className="w-3.5 h-3.5 text-accent" />
                    <span>Auto-Extracted EXIF Details</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono text-gray-300">
                    <div>
                      <span className="text-muted block text-[10px]">CAMERA</span>
                      {detectedCamera.make} {detectedCamera.model}
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">LENS</span>
                      {detectedCamera.lens || "Detected"}
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">SHUTTER</span>
                      {detectedCamera.shutter || "—"}
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">APERTURE</span>
                      {detectedCamera.aperture || "—"}
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">ISO</span>
                      {detectedCamera.iso || "—"}
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">FOCAL LENGTH</span>
                      {detectedCamera.focalLength || "—"}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Metadata Form */}
            <div className="lg:col-span-7 space-y-6">
              {/* Photo Title */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-200">
                  Photograph Title <span className="text-accent">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Snoqualmie Falls in Winter Mist"
                  required
                  className="w-full bg-surface border border-surface-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-200">
                  Description / Story
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="The story, atmosphere, or technical approach behind this image..."
                  className="w-full bg-surface border border-surface-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                />
              </div>

              {/* Photo ID & Capture Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-200 font-mono">
                    Photo ID
                  </label>
                  <input
                    type="text"
                    value={photoID}
                    onChange={(e) => setPhotoID(e.target.value)}
                    placeholder="dYYYYMMDDHHMMSS"
                    required
                    className="w-full bg-surface border border-surface-border rounded px-3 py-2 text-xs font-mono text-gray-300 focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-200">
                    Capture Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={captureDate}
                    onChange={(e) => setCaptureDate(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Albums / Categories Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-200 flex items-center space-x-1.5">
                  <Folder className="w-3.5 h-3.5 text-accent" />
                  <span>Albums / Categories</span>
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-black/40 border border-surface-border/60 rounded">
                  {KNOWN_CATEGORIES.map((cat) => {
                    const isSelected = selectedCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`text-xs px-2.5 py-1 rounded transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-accent text-black font-semibold"
                            : "bg-surface hover:bg-surface-hover text-gray-300"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>

                {/* Add Custom Category */}
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="text"
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomCategory();
                      }
                    }}
                    placeholder="Add custom category..."
                    className="bg-surface border border-surface-border rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-accent flex-1"
                  />
                  <button
                    type="button"
                    onClick={addCustomCategory}
                    className="bg-surface-hover border border-surface-border hover:border-accent text-xs px-3 py-1 rounded text-gray-200 transition-colors cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Tags / Keywords */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-200 flex items-center space-x-1.5">
                  <Tag className="w-3.5 h-3.5 text-accent" />
                  <span>Tags / Keywords (comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g. Washington, Cascades, stream, rocks, autumn, Sony"
                  className="w-full bg-surface border border-surface-border rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                />
              </div>

              {/* Tripod & Availability */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-200">
                    Tripod Support
                  </label>
                  <select
                    value={tripod}
                    onChange={(e) => setTripod(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-accent cursor-pointer"
                  >
                    {TRIPOD_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-gray-200">
                    Print Order Availability
                  </label>
                  <select
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value)}
                    className="w-full bg-surface border border-surface-border rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="Available for Order">Available for Order</option>
                    <option value="Not for Sale">Not for Sale</option>
                  </select>
                </div>
              </div>

              {/* GPS Coordinates & Interactive Map Picker */}
              <div className="space-y-2 pt-2 border-t border-surface-border/60">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-gray-200 flex items-center space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-accent" />
                    <span>Location Coordinates (Click map to pin)</span>
                  </label>

                  {latitude !== null && longitude !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setLatitude(null);
                        setLongitude(null);
                      }}
                      className="text-[11px] text-muted hover:text-red-400 transition-colors"
                    >
                      Clear Location
                    </button>
                  )}
                </div>

                <AdminMapPicker
                  latitude={latitude}
                  longitude={longitude}
                  onChange={(lat, lon) => {
                    setLatitude(lat);
                    setLongitude(lon);
                  }}
                />

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div>
                    <span className="text-muted block text-[10px]">LATITUDE</span>
                    <input
                      type="number"
                      step="any"
                      value={latitude !== null ? latitude : ""}
                      onChange={(e) =>
                        setLatitude(e.target.value ? parseFloat(e.target.value) : null)
                      }
                      placeholder="e.g. 47.791100"
                      className="w-full bg-surface border border-surface-border rounded px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <span className="text-muted block text-[10px]">LONGITUDE</span>
                    <input
                      type="number"
                      step="any"
                      value={longitude !== null ? longitude : ""}
                      onChange={(e) =>
                        setLongitude(e.target.value ? parseFloat(e.target.value) : null)
                      }
                      placeholder="e.g. -121.103000"
                      className="w-full bg-surface border border-surface-border rounded px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {submitError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
                  {submitError}
                </div>
              )}

              {/* Publish Action Button */}
              <div className="pt-4 flex items-center space-x-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-accent hover:bg-accent-light text-black font-semibold text-sm px-6 py-2.5 rounded transition-all cursor-pointer flex items-center space-x-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {isSubmitting ? "Processing & Publishing..." : "Publish Photograph"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-muted hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

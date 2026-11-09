import { Photo } from "@/types/photo";
import { Camera, Film, Compass, Crosshair, Sliders, Calendar, MapPin, ShoppingBag } from "lucide-react";

interface TechnicalDetailsProps {
  photo: Photo;
}

export function TechnicalDetails({ photo }: TechnicalDetailsProps) {
  const isAnalogFilm = photo.film && photo.film.toLowerCase() !== "digital";

  // Calculate megapixels if size exists
  const megapixels = photo.size
    ? ((photo.size.width * photo.size.height) / 1_000_000).toFixed(1)
    : null;

  return (
    <div className="bg-surface border border-surface-border rounded-sm p-6 space-y-6 text-sm">
      <div className="flex items-center justify-between border-b border-surface-border pb-4">
        <h3 className="font-semibold text-white tracking-wide flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-accent" />
          <span>Technical & Exposure Details</span>
        </h3>
        <span className="text-xs text-muted font-mono">ID: {photo.photoID}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Gear & Optics */}
        <div className="space-y-2">
          <h4 className="text-xs uppercase tracking-wider text-muted font-semibold flex items-center space-x-1.5">
            <Camera className="w-3.5 h-3.5 text-gray-400" />
            <span>Camera & Lens</span>
          </h4>
          <div className="space-y-1 text-gray-200">
            <div><span className="text-muted text-xs">Camera:</span> {photo.camera}</div>
            {photo.lens && <div><span className="text-muted text-xs">Lens:</span> {photo.lens}</div>}
            {photo.tripod && (
              <div><span className="text-muted text-xs">Tripod:</span> {photo.tripod}</div>
            )}
            <div>
              <span className="text-muted text-xs">Capture Medium:</span>{" "}
              <span className={isAnalogFilm ? "text-amber-300 font-medium" : ""}>
                {photo.film}
              </span>
            </div>
          </div>
        </div>

        {/* Exposure Settings */}
        <div className="space-y-2">
          <h4 className="text-xs uppercase tracking-wider text-muted font-semibold flex items-center space-x-1.5">
            <Crosshair className="w-3.5 h-3.5 text-gray-400" />
            <span>Exposure Pyramid</span>
          </h4>
          <div className="space-y-1 text-gray-200">
            <div className="flex items-center space-x-4">
              {photo.focalLength && <span><span className="text-muted text-xs">Focal:</span> {photo.focalLength}</span>}
              {photo.aperture && <span><span className="text-muted text-xs">Aperture:</span> {photo.aperture}</span>}
            </div>
            <div className="flex items-center space-x-4">
              {photo.shutterspeed && <span><span className="text-muted text-xs">Shutter:</span> {photo.shutterspeed}s</span>}
              {photo.sensitivity && <span><span className="text-muted text-xs">ISO:</span> {photo.sensitivity.replace("ISO ", "")}</span>}
            </div>
            {photo.exposureCompensation && (
              <div><span className="text-muted text-xs">Exposure Comp:</span> {photo.exposureCompensation}</div>
            )}
            {photo.whiteBalance && (
              <div><span className="text-muted text-xs">White Balance:</span> {photo.whiteBalance}</div>
            )}
          </div>
        </div>

        {/* Capture Date & Dimensions */}
        <div className="space-y-2">
          <h4 className="text-xs uppercase tracking-wider text-muted font-semibold flex items-center space-x-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>Dimensions & Date</span>
          </h4>
          <div className="space-y-1 text-gray-200">
            <div>
              <span className="text-muted text-xs">Date:</span>{" "}
              {photo.dateTaken.year}-{String(photo.dateTaken.month).padStart(2, "0")}-{String(photo.dateTaken.day).padStart(2, "0")}
            </div>
            {photo.size && (
              <div>
                <span className="text-muted text-xs">Resolution:</span> {photo.size.width} × {photo.size.height}
                {megapixels && <span className="text-gray-400 text-xs"> ({megapixels} MP)</span>}
              </div>
            )}
            {photo.availability && (
              <div className="pt-1 flex items-center space-x-1.5 text-accent text-xs">
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>{photo.availability}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Geospatial Location */}
      {photo.location && (
        <div className="border-t border-surface-border pt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2 text-gray-300">
            <MapPin className="w-4 h-4 text-accent" />
            <span>Coordinates:</span>
            <span className="font-mono text-gray-400">
              {photo.location.latitude.toFixed(5)}, {photo.location.longitude.toFixed(5)}
            </span>
          </div>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${photo.location.latitude},${photo.location.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-accent-light underline underline-offset-4"
          >
            View on Map ↗
          </a>
        </div>
      )}
    </div>
  );
}

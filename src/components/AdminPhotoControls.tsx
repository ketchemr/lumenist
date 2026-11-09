"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, X, CheckCircle2, Sliders } from "lucide-react";
import { EditPhotoModal } from "@/components/EditPhotoModal";

interface AdminPhotoControlsProps {
  photoID: string;
  title: string;
}

export function AdminPhotoControls({ photoID, title }: AdminPhotoControlsProps) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    fetch("/api/admin/auth")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setIsAdmin(true);
        }
      })
      .catch(() => {});
  }, []);

  if (!isAdmin) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError("");

    try {
      const res = await fetch(`/api/admin/photo/${encodeURIComponent(photoID)}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to delete photograph");
      }

      setShowConfirm(false);
      // Redirect to explore page
      router.push("/explore");
      router.refresh();
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete photograph");
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex items-center space-x-2">
        <button
          type="button"
          onClick={() => setShowEditModal(true)}
          className="inline-flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-medium text-accent bg-accent/10 border border-accent/40 hover:bg-accent/20 hover:border-accent transition-colors cursor-pointer"
          title="Edit photograph details, coordinates, or replace image file"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Edit Photo</span>
        </button>

        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="inline-flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-medium text-red-400 bg-red-950/20 border border-red-900/40 hover:bg-red-900/30 hover:border-red-600 transition-colors cursor-pointer"
          title="Delete photograph from catalog and disk"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Photo</span>
        </button>
      </div>

      {/* Edit Photo Modal */}
      <EditPhotoModal
        photoID={photoID}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSaved={() => {
          router.refresh();
        }}
      />

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-surface-border rounded-sm max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-start space-x-3.5">
              <div className="p-2.5 rounded-full bg-red-950/40 border border-red-800 text-red-400 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-medium text-foreground">
                  Permanently Delete Photograph?
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                  Are you sure you want to delete <strong className="text-foreground">&ldquo;{title}&rdquo;</strong> (ID: <code className="text-accent font-mono">{photoID}</code>)?
                </p>
              </div>
            </div>

            <div className="bg-red-950/20 border border-red-900/50 rounded p-3 text-xs text-foreground space-y-1">
              <p className="text-red-400 font-medium text-[11px] uppercase tracking-wider">
                This action will permanently delete:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-muted pl-1">
                <li>Desktop web JPEG and original fullsize file from disk</li>
                <li>Companion <code>.txt</code> metadata record</li>
                <li>Catalog entry in <code>data/photos.json</code></li>
              </ul>
            </div>

            {deleteError && (
              <p className="text-xs text-red-400 font-medium">{deleteError}</p>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 bg-surface hover:bg-surface-hover border border-surface-border text-muted hover:text-foreground text-xs rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded shadow-md transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? "Deleting..." : "Permanently Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

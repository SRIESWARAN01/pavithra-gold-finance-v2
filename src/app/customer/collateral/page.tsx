'use client';

import React, { useState, useEffect } from 'react';
import { Coins, Image as ImageIcon, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { isFirebaseConfigured, getCurrentProfile } from '@/lib/auth';
import { getGoldByCustomer } from '@/lib/db/gold';

export default function CustomerCollateral() {
  const [goldCollateral, setGoldCollateral] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Photo lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxPhotos, setLightboxPhotos] = useState<{ url: string; label: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxTitle, setLightboxTitle] = useState('');
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    async function loadCollateral() {
      setLoading(true);
      try {
        const profile = await getCurrentProfile();
        if (!profile) return;

        const items = await getGoldByCustomer(profile.id);
        if (items.length > 0) {
          setGoldCollateral(items.map(item => ({
            ...item,
            photos: item.photos || [],
          })));
        }
      } catch (err) {
        console.error('Failed to load collateral:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCollateral();
  }, []);

  /**
   * Open lightbox for a collateral item.
   * Collects photos from the photos array + inline photo URLs (front/back/side).
   */
  const openPhotoViewer = (item: any) => {
    const photos: { url: string; label: string }[] = [];

    // Add inline photo URLs if present
    if (item.front_photo_url) photos.push({ url: item.front_photo_url, label: 'Front View' });
    if (item.back_photo_url) photos.push({ url: item.back_photo_url, label: 'Back View' });
    if (item.side_photo_url) photos.push({ url: item.side_photo_url, label: 'Side View' });

    // Add photos from the gold_photos collection
    if (item.photos && item.photos.length > 0) {
      item.photos.forEach((photo: any, idx: number) => {
        photos.push({ url: photo.photo_url, label: `Photo ${idx + 1}` });
      });
    }

    if (photos.length === 0) {
      return; // No photos to show
    }

    setLightboxTitle(item.item_description || 'Gold Collateral');
    setLightboxPhotos(photos);
    setLightboxIndex(0);
    setLightboxOpen(true);
  };

  const hasPhotos = (item: any): boolean => {
    return !!(
      item.front_photo_url ||
      item.back_photo_url ||
      item.side_photo_url ||
      (item.photos && item.photos.length > 0)
    );
  };

  const getPhotoCount = (item: any): number => {
    let count = 0;
    if (item.front_photo_url) count++;
    if (item.back_photo_url) count++;
    if (item.side_photo_url) count++;
    if (item.photos) count += item.photos.length;
    return count;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 tracking-wide font-outfit">My Pawned Collateral</h2>
        <p className="text-gray-500 text-xs mt-1">Detailed inventory of physical gold ornaments secured inside PGF vaults.</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12 text-[#2563EB]">
          <Loader2 size={20} className="animate-spin mr-2" />
          <span className="text-sm">Loading collateral data...</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {goldCollateral.map((item) => (
          <div 
            key={item.id}
            className="bg-[#ffffff] border border-[#E5E7EB] hover:border-[#2563EB]/20 transition-all duration-300 rounded-xl p-5 space-y-4"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-[#F3F4F6] border border-[#2563EB]/25 flex items-center justify-center text-[#2563EB]">
                  <Coins size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{item.item_description}</h3>
                  <span className="text-[10px] text-gray-400 font-mono">Vault Storage Bin: {item.storage_bin_id}</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#F3F4F6] border border-[#2563EB]/20 text-[#2563EB] text-[10px] font-bold">
                {item.purity_karat}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[#F8FAFC]/50 border border-[#E5E7EB] p-3 rounded-lg text-center text-xs">
              <div>
                <span className="text-gray-400 block text-[9px] uppercase tracking-wider">Gross Weight</span>
                <span className="text-gray-900 font-medium">{item.gross_weight?.toFixed(2) || '0.00'}g</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[9px] uppercase tracking-wider">Stone Wt</span>
                <span className="text-gray-900 font-medium">{item.stone_weight?.toFixed(2) || '0.00'}g</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[9px] uppercase tracking-wider">Net Weight</span>
                <span className="text-[#2563EB] font-semibold">{item.net_weight?.toFixed(2) || '0.00'}g</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs pt-1">
              <span className="text-gray-500">Pledge Market Value:</span>
              <span className="text-gray-900 font-bold">Rs. {(item.valuation_inr || 0).toLocaleString('en-IN')}</span>
            </div>

            {/* Collateral Photos — Dynamic state based on availability */}
            {hasPhotos(item) ? (
              <button
                onClick={() => openPhotoViewer(item)}
                className="w-full border border-[#2563EB]/20 hover:border-[#2563EB]/40 bg-[#F3F4F6]/30 hover:bg-[#F3F4F6]/50 rounded-lg p-4 text-center cursor-pointer transition-all duration-200 group"
              >
                <ImageIcon size={18} className="mx-auto text-[#2563EB] mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] text-[#2563EB] block font-semibold">
                  View {getPhotoCount(item)} Vault Photo{getPhotoCount(item) > 1 ? 's' : ''}
                </span>
              </button>
            ) : (
              <div className="border border-dashed border-[#E5E7EB] bg-[#F3F4F6]/10 rounded-lg p-4 text-center">
                <ImageIcon size={18} className="mx-auto text-slate-600 mb-1" />
                <span className="text-[10px] text-gray-400 block font-medium">No vault photos available</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ─── Photo Lightbox Modal ──────────────────────────────────── */}
      {lightboxOpen && lightboxPhotos.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative bg-[#ffffff] border border-[#E5E7EB] rounded-2xl max-w-2xl w-full mx-4 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
              <div>
                <h3 className="text-sm font-bold text-gray-900 font-outfit">{lightboxTitle}</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {lightboxPhotos[lightboxIndex]?.label} — {lightboxIndex + 1} of {lightboxPhotos.length}
                </p>
              </div>
              <button
                onClick={() => setLightboxOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[#F3F4F6] text-gray-500 hover:text-gray-900 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Photo Display */}
            <div className="relative aspect-video bg-[#F8FAFC] flex items-center justify-center">
              <img
                src={lightboxPhotos[lightboxIndex]?.url}
                alt={lightboxPhotos[lightboxIndex]?.label}
                className="max-w-full max-h-full object-contain"
                onError={() => setImageError(true)}
              />
              {/* Fallback when image fails */}
              {imageError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-gray-400 text-sm">Photo could not be loaded</p>
                </div>
              )}

              {/* Navigation Arrows */}
              {lightboxPhotos.length > 1 && (
                <>
                  <button
                    onClick={() => { setLightboxIndex(prev => prev > 0 ? prev - 1 : lightboxPhotos.length - 1); setImageError(false); }}
                    className="absolute left-3 p-2 rounded-full bg-[#ffffff]/80 hover:bg-[#F3F4F6] text-gray-900 transition border border-[#E5E7EB]"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => { setLightboxIndex(prev => prev < lightboxPhotos.length - 1 ? prev + 1 : 0); setImageError(false); }}
                    className="absolute right-3 p-2 rounded-full bg-[#ffffff]/80 hover:bg-[#F3F4F6] text-gray-900 transition border border-[#E5E7EB]"
                  >
                    <ChevronRight size={18} />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail Strip */}
            {lightboxPhotos.length > 1 && (
              <div className="flex gap-2 p-4 overflow-x-auto border-t border-[#E5E7EB]">
                {lightboxPhotos.map((photo, idx) => (
                  <button
                    key={idx}
                    onClick={() => setLightboxIndex(idx)}
                    className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                      idx === lightboxIndex
                        ? 'border-[#2563EB] ring-1 ring-[#2563EB]/30'
                        : 'border-[#E5E7EB] hover:border-[#E5E7EB]/60 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={photo.url}
                      alt={photo.label}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

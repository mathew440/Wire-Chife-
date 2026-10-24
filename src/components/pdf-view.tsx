"use client";

import { Button } from "@/components/ui/button";
import { assetPath } from "@/lib/base-path";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

export function PdfCanvas({ data }: { data: Uint8Array }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const scaleRef = useRef(1);
  const [scale, setScale] = useState(1);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(0);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    let cancelled = false;
    let loading: { destroy: () => Promise<void> } | null = null;
    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = assetPath("/pdf.worker.min.mjs");
      const copy = new Uint8Array(data.byteLength);
      copy.set(data);
      const task = pdfjs.getDocument({ data: copy });
      loading = task;
      const pdf = await task.promise;
      if (cancelled) return;
      pdfRef.current = pdf;
      setPages(pdf.numPages);
      setPage(1);
      const first = await pdf.getPage(1);
      const width = wrapRef.current?.clientWidth ?? 360;
      const unscaled = first.getViewport({ scale: 1 });
      const fitted = Math.min(2.4, Math.max(0.6, (width - 8) / unscaled.width));
      setScale(fitted);
      setReady((value) => value + 1);
    })().catch((caught: unknown) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not open this PDF.");
    });
    return () => {
      cancelled = true;
      pdfRef.current = null;
      void loading?.destroy();
    };
  }, [data]);

  useEffect(() => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas || ready === 0) return;
    let cancelled = false;
    (async () => {
      const pdfPage = await pdf.getPage(page);
      const viewport = pdfPage.getViewport({ scale });
      if (cancelled) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await pdfPage.render({ canvas, viewport }).promise;
    })().catch((caught: unknown) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not draw this page.");
    });
    return () => {
      cancelled = true;
    };
  }, [page, scale, ready]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let startDist = 0;
    let startScale = 1;
    const distance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    };
    const start = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        startDist = distance(event.touches);
        startScale = scaleRef.current;
      }
    };
    const move = (event: TouchEvent) => {
      if (event.touches.length === 2 && startDist > 0) {
        event.preventDefault();
        const next = Math.min(4, Math.max(0.6, startScale * (distance(event.touches) / startDist)));
        setScale(next);
      }
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
    };
  }, []);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setScale((value) => Math.max(0.6, value - 0.25))}>
          Zoom out
        </Button>
        <Button type="button" variant="outline" onClick={() => setScale((value) => Math.min(4, value + 0.25))}>
          Zoom in
        </Button>
        <Button type="button" variant="secondary" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>
          Previous page
        </Button>
        <Button type="button" variant="secondary" onClick={() => setPage((value) => Math.min(pages, value + 1))} disabled={page >= pages}>
          Next page
        </Button>
        <span className="self-center text-sm text-muted-foreground">
          Page {page} of {pages} · pinch to zoom
        </span>
      </div>
      {error ? <p className="text-sm text-orange">{error}</p> : null}
      <div ref={wrapRef} className="max-h-[75vh] overflow-auto rounded-xl bg-white p-2">
        <canvas ref={canvasRef} className="mx-auto h-auto max-w-none" />
      </div>
    </div>
  );
}

export function ZoomImage({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let startDist = 0;
    let startScale = 1;
    const distance = (touches: TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const start = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        startDist = distance(event.touches);
        startScale = scaleRef.current;
      }
    };
    const move = (event: TouchEvent) => {
      if (event.touches.length === 2 && startDist > 0) {
        event.preventDefault();
        setScale(Math.min(4, Math.max(0.6, startScale * (distance(event.touches) / startDist))));
      }
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
    };
  }, []);
  return (
    <div className="grid gap-3">
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => setScale((value) => Math.max(0.6, value - 0.25))}>
          Zoom out
        </Button>
        <Button type="button" variant="outline" onClick={() => setScale((value) => Math.min(4, value + 0.25))}>
          Zoom in
        </Button>
      </div>
      <div ref={wrapRef} className="max-h-[75vh] overflow-auto rounded-xl bg-black p-2">
        {/* User photos are local blobs, not remote optimized images. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} style={{ width: `${scale * 100}%`, maxWidth: "none" }} className="h-auto" />
      </div>
    </div>
  );
}

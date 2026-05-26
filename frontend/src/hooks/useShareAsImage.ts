import { useCallback, useState, type RefObject } from "react";
import { toPng } from "html-to-image";

type ImageOptions = {
  filename: string;
  shareTitle?: string;
  shareText?: string;
};

const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: "image/png" });
};

const triggerDownload = (dataUrl: string, filename: string) => {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export function useShareAsImage(nodeRef: RefObject<HTMLDivElement | null>) {
  const [busyAction, setBusyAction] = useState<"share" | "download" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const renderPng = useCallback(async (): Promise<string | null> => {
    const node = nodeRef.current;
    if (!node) {
      setError("Nothing to share yet.");
      return null;
    }
    return toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#0a0817",
    });
  }, [nodeRef]);

  const shareImage = useCallback(
    async ({ filename, shareTitle, shareText }: ImageOptions) => {
      setError(null);
      setBusyAction("share");
      try {
        const dataUrl = await renderPng();
        if (!dataUrl) return;
        const file = await dataUrlToFile(dataUrl, filename);

        const nav = navigator as Navigator & {
          canShare?: (data: ShareData) => boolean;
        };
        if (
          typeof nav.share === "function" &&
          typeof nav.canShare === "function" &&
          nav.canShare({ files: [file] })
        ) {
          try {
            await nav.share({ files: [file], title: shareTitle, text: shareText });
            return;
          } catch (err) {
            if ((err as DOMException)?.name === "AbortError") return;
            throw err;
          }
        }
        setError("Share isn't supported here. Use Download instead.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not share image.");
      } finally {
        setBusyAction(null);
      }
    },
    [renderPng]
  );

  const downloadImage = useCallback(
    async ({ filename }: ImageOptions) => {
      setError(null);
      setBusyAction("download");
      try {
        const dataUrl = await renderPng();
        if (!dataUrl) return;
        triggerDownload(dataUrl, filename);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not download image.");
      } finally {
        setBusyAction(null);
      }
    },
    [renderPng]
  );

  return {
    shareImage,
    downloadImage,
    isSharing: busyAction === "share",
    isDownloading: busyAction === "download",
    error,
  };
}

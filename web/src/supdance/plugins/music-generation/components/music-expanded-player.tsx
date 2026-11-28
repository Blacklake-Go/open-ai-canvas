import { useId } from "react";
import { ChevronDown, Disc3 } from "lucide-react";
import { CachedResourceImage } from "@/components/cached-resource-image";
import { IconButton } from "@/components/ui/base/buttons";
import { AppModal } from "@/components/ui/product/app-modal";
import { useI18n } from "@/supdance/plugins/i18n";
import type { MusicOutput, MusicTask } from "../services/music-api";
import { useMusicCover } from "./music-cover-controls";
import { MusicLyricsDisplay } from "./music-lyrics-display";
import { WaveformPlayer } from "./waveform-player";
import "../styles/music-workbench.css";

export function MusicExpandedPlayer({ task, output, open, onClose, navigation }: { task: MusicTask; output: MusicOutput; open: boolean; onClose: () => void; navigation?: { previous?: () => void; next?: () => void } }) {
    const { t } = useI18n();
    const titleId = useId();
    const title = task.title || t("music.default_track_title");
    const cover = useMusicCover(task.userId, task.taskId, open && Boolean(task.coverSupported), task.cover);
    const instrumental = task.instrumental || /^(instrumental|accompaniment)$/i.test(output.stemName?.trim() || "");
    const fallback = <Disc3 size={48} aria-hidden />;
    return (
        <AppModal
            open={open}
            onCancel={onClose}
            aria-labelledby={titleId}
            closable={false}
            footer={null}
            maskClosable={false}
            transitionName="music-lyrics-motion"
            flush
            width="100%"
            rootClassName="plugin-music-generation music-expanded-modal"
            classNames={{ wrapper: "music-expanded-wrap", container: "music-expanded-container" }}
            style={{ top: 0, maxWidth: "100%", margin: 0, padding: 0 }}
        >
            <div className="music-expanded-shell" data-i18n-ignore="true">
                <header className="music-expanded-top">
                    <IconButton icon={ChevronDown} className="size-11" aria-label={t("common.close")} onClick={onClose} />
                </header>
                <div className="music-expanded-content">
                    <div className="music-expanded-art">{cover.data?.storageKey ? <CachedResourceImage storageKey={cover.data.storageKey} alt="" className="size-full object-cover" fallback={fallback} /> : fallback}</div>
                    <header className="music-expanded-track">
                        <h1 id={titleId}>{title}</h1>
                        {task.model && <p>{task.model}</p>}
                    </header>
                    <MusicLyricsDisplay key={output.id} expanded lyrics={instrumental ? "" : task.lyrics?.trim() || ""} instrumental={instrumental} output={output} />
                </div>
                <WaveformPlayer key={output.id} docked={false} taskId={output.id} audioUrl={output.audioUrl} title={title} durationSeconds={(output.durationMs || 0) / 1000} output={output} navigation={navigation} onToggleLyrics={onClose} />
            </div>
        </AppModal>
    );
}

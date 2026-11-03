/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vencord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { findStoreLazy } from "@webpack";
import { ChannelStore, FluxDispatcher, PopoutWindowStore, SelectedChannelStore, UserStore } from "@webpack/common";

const StreamingStore = findStoreLazy("ApplicationStreamingStore");
const logger = new Logger("AutoStreamPopout");
const pending = new Map<string, ReturnType<typeof setTimeout>>();
const windowKey = "DISCORD_CHANNEL_CALL_POPOUT";

function cancel(streamKey: string) {
    clearTimeout(pending.get(streamKey));
    pending.delete(streamKey);
}

function cancelAll() {
    pending.forEach(clearTimeout);
    pending.clear();
}

function openStream(streamKey: string) {
    pending.delete(streamKey);

    try {
        const stream = StreamingStore.getActiveStreamForStreamKey(streamKey);
        if (!stream || stream.ownerId === UserStore.getCurrentUser()?.id)
            return;

        if (stream.channelId !== SelectedChannelStore.getVoiceChannelId() || PopoutWindowStore.getWindowOpen(windowKey))
            return;

        const channel = ChannelStore.getChannel(stream.channelId);
        if (channel)
            FluxDispatcher.dispatch({ type: "CHANNEL_CALL_POPOUT_WINDOW_OPEN", channel });
    } catch (error) {
        logger.error("Could not open the stream popout", error);
    }
}

export default definePlugin({
    name: "AutoStreamPopout",
    description: "Automatically opens streams you watch in Discord's native popout window.",
    authors: [{ name: "Local", id: 0n }],

    flux: {
        STREAM_WATCH({ streamKey }: { streamKey: string; }) {
            cancel(streamKey);
            // Let Discord finish updating the active stream and focused participant first.
            pending.set(streamKey, setTimeout(() => openStream(streamKey), 0));
        },
        STREAM_CLOSE({ streamKey }: { streamKey: string; }) {
            cancel(streamKey);
        },
        STREAM_DELETE({ streamKey }: { streamKey: string; }) {
            cancel(streamKey);
        },
        LOGOUT: cancelAll
    },

    stop: cancelAll
});

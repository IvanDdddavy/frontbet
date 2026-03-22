#!/bin/sh
# Generates /media/playlist.m3u from uploaded audio files
# Called by backend when playlist changes

MEDIA_DIR="${MEDIA_DIR:-/media}"
PLAYLIST="$MEDIA_DIR/playlist.m3u"

echo "#EXTM3U" > "$PLAYLIST"

find "$MEDIA_DIR" -type f \( -name "*.mp3" -o -name "*.wav" -o -name "*.ogg" -o -name "*.webm" \) \
  ! -path "*/voices/*" \
  -printf "#EXTINF:-1,%f\n%p\n" >> "$PLAYLIST"

echo "Playlist updated: $(grep -c "^/" "$PLAYLIST" 2>/dev/null || echo 0) tracks"

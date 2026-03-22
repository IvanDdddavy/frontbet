#!/usr/bin/liquidsoap
# ТТК Radio - Liquidsoap stream source
# Plays files from /media directory in rotation, loops playlist

set("log.level", 3)
set("log.stdout", true)
set("server.socket", false)
set("server.telnet", true)
set("server.telnet.bind_addr", "0.0.0.0")
set("server.telnet.port", 1234)

# Load playlist from media directory
# Only ogg/mp3/wav are natively supported by Liquidsoap
playlist = playlist(
  reload=1,
  reload_mode="watch",
  mode="normal",
  mime_type="",
  "/app/media/playlist.m3u"
)

# Fallback to silence if playlist is empty
radio = fallback(
  track_sensitive=false,
  [playlist, blank()]
)

# Apply some basic processing
radio = normalize(radio)
radio = audio_to_stereo(radio)

# Output to Icecast
output.icecast(
  %ogg(%vorbis(quality=0.6)),
  host="icecast",
  port=8000,
  password="ttk_source_pass",
  mount="/stream",
  name="ТТК Эфир",
  description="Корпоративное радио ТрансТелеКом",
  public=false,
  radio
)

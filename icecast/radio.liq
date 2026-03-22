#!/usr/bin/liquidsoap
# ТТК Radio — Liquidsoap v2.x

settings.log.level := 3
settings.log.stdout := true
settings.server.socket := false
settings.server.telnet := true
settings.server.telnet.bind_addr := "0.0.0.0"
settings.server.telnet.port := 1234

playlist_path = "/app/media/playlist.m3u"

# Если плейлист не существует — создаём пустой, чтобы Liquidsoap не падал при старте
if not file.exists(playlist_path) then
  file.write(data="#EXTM3U\n", playlist_path)
end

# reload_mode="watch" — Liquidsoap сам следит за изменениями файла
music = playlist(
  reload=1,
  reload_mode="watch",
  mode="normal",
  playlist_path
)

# Запасной источник — тишина если плейлист пуст
radio = fallback(track_sensitive=false, [music, blank()])

# Нормализация громкости (v2.x синтаксис)
radio = normalize(radio)
radio = audio_to_stereo(radio)

# Стримим в Icecast в MP3 128kbps
output.icecast(
  %mp3(bitrate=128),
  host="icecast",
  port=8000,
  password="ttk_source_pass",
  mount="/stream",
  name="ТТК Эфир",
  description="Корпоративное радио ТрансТелеКом",
  public=false,
  radio
)

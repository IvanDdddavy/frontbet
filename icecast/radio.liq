#!/usr/bin/liquidsoap
# ТТК Radio — Liquidsoap v2.x

settings.log.level := 3
settings.log.stdout := true
settings.server.socket := false
settings.server.telnet := true
settings.server.telnet.bind_addr := "0.0.0.0"
settings.server.telnet.port := 1234

playlist_path = "/app/media/playlist.m3u"

# Создаём пустой playlist.m3u если не существует — чтобы не падать при старте
if not file.exists(playlist_path) then
  file.write(data="#EXTM3U\n", playlist_path)
end

# reload_mode="watch" — Liquidsoap сам следит за изменениями файла
# on_fail — когда плейлист пуст или файл не читается, возвращаем blank вместо краша
music = playlist(
  reload=1,
  reload_mode="watch",
  mode="normal",
  playlist_path
)

# track_sensitive=false — fallback переключается между источниками
# не дожидаясь конца трека. Это важно: когда музыка появляется после
# паузы — Liquidsoap мгновенно переходит с blank() на playlist
radio = fallback(track_sensitive=false, [music, blank()])

radio = normalize(radio)
radio = audio_to_stereo(radio)

# Стримим в Icecast MP3 128kbps
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

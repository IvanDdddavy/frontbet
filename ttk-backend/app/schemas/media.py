from pydantic import BaseModel
from datetime import datetime


class MediaFileOut(BaseModel):
    id:         str
    filename:   str
    mediaType:  str
    mimeType:   str
    sizeBytes:  int
    uploadedAt: str
    url:        str = ""   # public URL for playback, e.g. /media/owner_id/file_id.mp3

    model_config = {"from_attributes": True}


class PlaylistItemOut(BaseModel):
    id:        int
    position:  int
    mediaFile: MediaFileOut

    model_config = {"from_attributes": True}


class PlaylistOut(BaseModel):
    id:          str
    title:       str
    loopMode:    bool
    shuffleMode: bool
    items:       list[PlaylistItemOut]

    model_config = {"from_attributes": True}


class PlaylistCreate(BaseModel):
    title:        str = "Плейлист"
    loop_mode:    bool = False
    shuffle_mode: bool = False


class PlaylistUpdate(BaseModel):
    title:        str | None = None
    loop_mode:    bool | None = None
    shuffle_mode: bool | None = None
    item_ids:     list[str] | None = None  # ordered media file ids

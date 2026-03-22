from pydantic import BaseModel, field_validator
from datetime import datetime


class MessageCreate(BaseModel):
    content: str = ""


class MessageOut(BaseModel):
    id:          str
    senderId:    str | None
    senderLogin: str
    content:     str
    voicePath:   str | None
    status:      str
    createdAt:   str

    model_config = {"from_attributes": True}


class MessageStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = {"new", "in_progress", "done"}
        if v not in allowed:
            raise ValueError(f"Недопустимый статус: {v}")
        return v


class StreamStateOut(BaseModel):
    isLive:       bool
    isVideo:      bool
    currentTrack: str | None
    listeners:    int

from pydantic import BaseModel, field_validator
from datetime import datetime
import re

LATIN_RE  = re.compile(r'^[a-zA-Z][a-zA-Z0-9_]+$')
CYRILLIC_RE = re.compile(r'^[А-ЯЁа-яё\s]+$')
PASSWORD_RE = re.compile(r'^[a-zA-Z0-9!@#$%^&*()\-_=+\[\]{};:\'",.<>/?`~\\|]+$')


class RegisterRequest(BaseModel):
    model_config = {"populate_by_name": True}
    login:     str
    password:  str
    full_name: str = ""
    fullName:  str = ""

    @property
    def resolved_full_name(self) -> str:
        """Return whichever name field was provided."""
        return (self.full_name or self.fullName).strip()

    @field_validator("login")
    @classmethod
    def validate_login(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Логин не может быть пустым")
        if not LATIN_RE.match(v):
            raise ValueError("Логин: только латиница, цифры и _")
        if len(v) < 3:
            raise ValueError("Логин минимум 3 символа")
        return v

    @field_validator("full_name", "fullName", mode="before")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        # Allow empty string — will be checked in auth_service after both fields available
        if not v:
            return v
        v = str(v).strip()
        if v and not CYRILLIC_RE.match(v):
            raise ValueError("ФИО должно содержать только русские буквы")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Пароль минимум 6 символов")
        if not PASSWORD_RE.match(v):
            raise ValueError("Пароль содержит недопустимые символы")
        return v


class LoginRequest(BaseModel):
    login:    str
    password: str


class UserOut(BaseModel):
    id:         str
    login:      str
    fullName:   str
    roles:      list[str]
    createdAt:  str

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    user:  UserOut
    token: str


class UserUpdate(BaseModel):
    login:     str | None = None
    full_name: str | None = None

    @field_validator("login")
    @classmethod
    def validate_login(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not LATIN_RE.match(v):
            raise ValueError("Логин: только латиница, цифры и _")
        return v

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not CYRILLIC_RE.match(v):
            raise ValueError("ФИО должно содержать только русские буквы")
        return v


class PasswordChange(BaseModel):
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Пароль минимум 6 символов")
        return v


class RolesAssign(BaseModel):
    roles: list[str]

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, v: list[str]) -> list[str]:
        allowed = {"user", "host", "admin"}
        for role in v:
            if role not in allowed:
                raise ValueError(f"Недопустимая роль: {role}")
        return v


class ForgotPasswordRequest(BaseModel):
    login: str

    @field_validator("login")
    @classmethod
    def strip_login(cls, v: str) -> str:
        return v.strip()


class ResetPasswordRequest(BaseModel):
    token:    str
    password: str

    @field_validator("password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Пароль минимум 6 символов")
        if not PASSWORD_RE.match(v):
            raise ValueError("Пароль содержит недопустимые символы")
        return v


class ResetTokenInfoResponse(BaseModel):
    valid:     bool
    login:     str
    expiresAt: str

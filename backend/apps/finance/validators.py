"""Validacao de anexos de contribuicao (comprovantes).

Regras:
- Extensoes/mimetypes permitidos: jpg, jpeg, png, pdf.
- Tamanho maximo: 8MB por arquivo.
- O tipo real e verificado pela assinatura (magic bytes) do conteudo, e nao
  apenas pela extensao — assim um arquivo ``.exe`` renomeado para ``.jpg`` e
  rejeitado.

Optamos por validar a assinatura manualmente (em vez de usar ``python-magic``)
para nao introduzir uma dependencia com biblioteca nativa (libmagic), que e
problematica no Windows.
"""
from rest_framework import serializers

MAX_UPLOAD_SIZE = 8 * 1024 * 1024  # 8MB
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "pdf"}


def _detect_type(header: bytes):
    """Detecta o tipo real do arquivo pela assinatura, ou ``None``."""
    if header.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if header.startswith(b"%PDF-"):
        return "pdf"
    return None


def _extension(name: str) -> str:
    return name.rsplit(".", 1)[-1].lower() if "." in name else ""


def validate_contribution_attachment(file) -> None:
    """Valida um unico anexo. Lanca ``ValidationError`` (em portugues) se invalido."""
    name = getattr(file, "name", "") or ""
    extension = _extension(name)

    if extension not in ALLOWED_EXTENSIONS:
        raise serializers.ValidationError(
            f'Arquivo "{name}": extensao nao permitida. Envie apenas jpg, jpeg, png ou pdf.'
        )

    size = getattr(file, "size", None)
    if size is not None and size > MAX_UPLOAD_SIZE:
        raise serializers.ValidationError(
            f'Arquivo "{name}": tamanho acima do limite de 8MB.'
        )

    header = file.read(8)
    if hasattr(file, "seek"):
        file.seek(0)

    detected = _detect_type(header)
    if detected is None:
        raise serializers.ValidationError(
            f'Arquivo "{name}": o conteudo nao corresponde a um jpg, jpeg, png ou pdf valido.'
        )

    expected = "jpeg" if extension in {"jpg", "jpeg"} else extension
    if detected != expected:
        raise serializers.ValidationError(
            f'Arquivo "{name}": o conteudo do arquivo nao corresponde a extensao informada.'
        )

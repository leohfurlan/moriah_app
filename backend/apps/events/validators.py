from rest_framework import serializers


MAX_ANNOUNCEMENT_IMAGE_SIZE = 8 * 1024 * 1024
ALLOWED_ANNOUNCEMENT_EXTENSIONS = {"jpg", "jpeg", "png"}


def validate_event_announcement_image(file) -> None:
    name = getattr(file, "name", "") or ""
    extension = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if extension not in ALLOWED_ANNOUNCEMENT_EXTENSIONS:
        raise serializers.ValidationError(
            f'Arquivo "{name}": envie uma imagem JPG ou PNG.'
        )
    if getattr(file, "size", 0) > MAX_ANNOUNCEMENT_IMAGE_SIZE:
        raise serializers.ValidationError(
            f'Arquivo "{name}": tamanho acima do limite de 8MB.'
        )
    header = file.read(8)
    if hasattr(file, "seek"):
        file.seek(0)
    valid_signature = header.startswith(b"\xff\xd8\xff") if extension in {"jpg", "jpeg"} else header.startswith(b"\x89PNG\r\n\x1a\n")
    if not valid_signature:
        raise serializers.ValidationError(
            f'Arquivo "{name}": o conteúdo não corresponde a uma imagem {extension.upper()} válida.'
        )

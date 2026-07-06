"""Captura do usuario responsavel pela requisicao para a auditoria.

Como as alteracoes auditadas podem vir tanto da API quanto do Django admin,
usamos um armazenamento por thread para disponibilizar o usuario atual aos
signals de auditoria (que nao tem acesso ao ``request``).

O usuario e resolvido de forma preguicosa a partir do ``request`` armazenado.
Isso e importante para requisicoes da API: com JWT, o ``request.user`` so e
definido pelo DRF quando a view roda — depois do middleware. Ao guardar o
``request`` (e nao o valor do usuario), lemos ``request.user`` no momento do
signal, quando o DRF ja autenticou.
"""
import threading

_state = threading.local()


def set_current_user(user):
    """Define explicitamente o usuario atual (util em testes/comandos)."""
    _state.user = user
    _state.request = None


def _clear():
    _state.user = None
    _state.request = None


def get_current_user():
    """Retorna o usuario autenticado da requisicao atual, ou ``None``."""
    user = getattr(_state, "user", None)
    if user is None:
        request = getattr(_state, "request", None)
        if request is not None:
            user = getattr(request, "user", None)
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    return user


class CurrentUserMiddleware:
    """Guarda o ``request`` da requisicao no armazenamento por thread."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _state.user = None
        _state.request = request
        try:
            return self.get_response(request)
        finally:
            _clear()

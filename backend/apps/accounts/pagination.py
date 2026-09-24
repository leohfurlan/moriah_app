from rest_framework.pagination import PageNumberPagination


class MoriahPagination(PageNumberPagination):
    """Paginação explícita para listas que podem crescer."""

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class OptionalPaginationMixin:
    """Preserva o contrato de lista enquanto o cliente não pede páginas."""

    pagination_class = MoriahPagination

    def paginate_queryset(self, queryset):
        if not ({"page", "page_size"} & set(self.request.query_params)):
            return None
        return super().paginate_queryset(queryset)

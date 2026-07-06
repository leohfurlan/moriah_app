from rest_framework.generics import RetrieveAPIView

from .serializers import MeSerializer


class MeView(RetrieveAPIView):
    serializer_class = MeSerializer

    def get_object(self):
        return self.request.user

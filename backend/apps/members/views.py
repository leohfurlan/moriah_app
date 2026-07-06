from rest_framework.generics import RetrieveAPIView

from .serializers import MemberSerializer


class MyMemberView(RetrieveAPIView):
    serializer_class = MemberSerializer

    def get_object(self):
        return self.request.user.member_profile

from rest_framework.generics import RetrieveAPIView

from apps.accounts.permissions import HasMemberProfile, get_member_profile

from .serializers import MemberSerializer


class MyMemberView(RetrieveAPIView):
    """Cadastro de membro do usuario autenticado."""

    serializer_class = MemberSerializer
    # Admin/tesouraria/secretaria nao tem cadastro de membro: sem isso a view
    # estoura 500 ao acessar o OneToOne reverso.
    permission_classes = [HasMemberProfile]

    def get_object(self):
        return get_member_profile(self.request.user)

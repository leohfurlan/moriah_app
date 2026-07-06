from rest_framework import serializers

from apps.members.models import Member
from apps.members.serializers import MemberSerializer

from .models import CellAttendance, CellMeeting


class CellAttendanceWriteSerializer(serializers.Serializer):
    member_id = serializers.IntegerField()
    present = serializers.BooleanField(default=True)
    note = serializers.CharField(required=False, allow_blank=True)


class CellMeetingSerializer(serializers.ModelSerializer):
    attendances = CellAttendanceWriteSerializer(many=True, write_only=True)

    class Meta:
        model = CellMeeting
        fields = ("id", "cell", "date", "notes", "visitors_count", "attendances")
        read_only_fields = ("cell",)

    def create(self, validated_data):
        attendances = validated_data.pop("attendances", [])
        meeting = CellMeeting.objects.create(**validated_data)
        members = {
            member.id: member
            for member in Member.objects.filter(id__in=[item["member_id"] for item in attendances], cell=meeting.cell)
        }
        CellAttendance.objects.bulk_create(
            [
                CellAttendance(
                    church=meeting.church,
                    meeting=meeting,
                    member=members[item["member_id"]],
                    present=item["present"],
                    note=item.get("note", ""),
                )
                for item in attendances
                if item["member_id"] in members
            ]
        )
        return meeting


class LeaderCellMemberSerializer(MemberSerializer):
    class Meta(MemberSerializer.Meta):
        fields = ("id", "full_name", "preferred_name", "phone", "email", "status", "cell_name")

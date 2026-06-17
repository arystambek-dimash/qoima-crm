import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.test.utils import override_settings
from rest_framework.test import APIClient

from core.enums import UserRole
from src.deals.models import Deal, DealFile, DealLink, DealStage


class CollaboratorDealAccessTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.collaborator = get_user_model().objects.create_user(
            username="client-a",
            email="client-a@example.com",
            password="password",
            role=UserRole.COLLABORATOR,
        )
        self.other_collaborator = get_user_model().objects.create_user(
            username="client-b",
            email="client-b@example.com",
            password="password",
            role=UserRole.COLLABORATOR,
        )
        self.shared_collaborator = get_user_model().objects.create_user(
            username="client-c",
            email="client-c@example.com",
            password="password",
            role=UserRole.COLLABORATOR,
        )
        self.own_deal = self.create_deal(self.collaborator)
        self.other_deal = self.create_deal(self.other_collaborator)

    def test_collaborator_sees_only_attached_deals(self):
        self.client.force_authenticate(self.collaborator)

        response = self.client.get("/api/deals/")

        self.assertEqual(response.status_code, 200)
        deal_ids = {item["id"] for item in self.results(response)}
        self.assertEqual(deal_ids, {self.own_deal.id})

    def test_collaborator_cannot_retrieve_other_collaborator_deal(self):
        self.client.force_authenticate(self.collaborator)

        response = self.client.get(f"/api/deals/{self.other_deal.id}/")

        self.assertEqual(response.status_code, 404)

    def test_collaborator_created_deal_is_attached_to_request_user(self):
        self.client.force_authenticate(self.collaborator)

        response = self.client.post(
            "/api/deals/",
            {
                "stage": "active",
                "date_start": "2026-06-01",
                "date_end": "2026-06-30",
                "deal_amount": "150000.00",
                "payment_type": "cash",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        deal = Deal.objects.get(pk=response.data["id"])
        self.assertEqual(deal.user, self.collaborator)
        self.assertEqual(list(deal.collaborators.all()), [self.collaborator])

    def test_collaborator_sees_deals_from_collaborators_many_to_many(self):
        shared_deal = self.create_deal(
            self.other_collaborator,
            collaborators=[self.collaborator, self.shared_collaborator],
        )
        self.client.force_authenticate(self.collaborator)

        response = self.client.get("/api/deals/")

        self.assertEqual(response.status_code, 200)
        deal_ids = {item["id"] for item in self.results(response)}
        self.assertEqual(deal_ids, {self.own_deal.id, shared_deal.id})

    def test_user_filter_matches_primary_and_many_to_many_collaborators(self):
        shared_deal = self.create_deal(
            self.other_collaborator,
            collaborators=[self.collaborator],
        )
        self.client.force_authenticate(self.collaborator)

        response = self.client.get(f"/api/deals/?user={self.collaborator.id}")

        self.assertEqual(response.status_code, 200)
        deal_ids = {item["id"] for item in self.results(response)}
        self.assertEqual(deal_ids, {self.own_deal.id, shared_deal.id})

    def create_deal(self, user, collaborators=None):
        deal = Deal.objects.create(
            user=user,
            stage="active",
            date_start="2026-06-01",
            date_end="2026-06-30",
            deal_amount="100000.00",
            payment_type="cash",
        )
        deal.collaborators.add(user)

        if collaborators:
            deal.collaborators.add(*collaborators)

        return deal

    def results(self, response):
        return response.data.get("results", response.data)


class ProjectFeatureTests(TestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media_root)
        self.override.enable()

        self.client = APIClient()
        self.admin = get_user_model().objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="password",
            role=UserRole.EMPLOYEE,
        )
        self.client_user = get_user_model().objects.create_user(
            username="client",
            email="client@example.com",
            password="password",
            role=UserRole.COLLABORATOR,
        )
        self.responsible = get_user_model().objects.create_user(
            username="kevin",
            email="kevin@example.com",
            password="password",
            first_name="Кевин",
            role=UserRole.EMPLOYEE,
        )
        self.client.force_authenticate(self.admin)

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media_root)

    def test_project_alias_creates_named_project_with_responsibles(self):
        response = self.client.post(
            "/api/projects/",
            {
                "name": "CRM для «Алтын Маркет»",
                "user": self.client_user.id,
                "responsibles": [self.responsible.id],
                "stage": "active",
                "date_start": "2026-06-01",
                "date_end": "2026-08-20",
                "deal_amount": "2800000.00",
                "payment_type": "card",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["name"], "CRM для «Алтын Маркет»")
        self.assertEqual(response.data["responsibles"], [self.responsible.id])
        self.assertEqual(
            response.data["responsible_details"][0]["username"],
            self.responsible.username,
        )

    def test_project_can_be_created_without_client(self):
        response = self.client.post(
            "/api/projects/",
            {
                "name": "Внутренний проект",
                "responsibles": [self.responsible.id],
                "stage": "active",
                "date_start": "2026-06-01",
                "date_end": "2026-08-20",
                "deal_amount": "500000.00",
                "payment_type": "card",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertIsNone(response.data["user"])
        self.assertEqual(response.data["collaborators"], [])
        self.assertEqual(response.data["name"], "Внутренний проект")

    def test_project_stages_links_and_files_are_returned_on_project(self):
        deal = self.create_project()

        stage_response = self.client.post(
            f"/api/projects/{deal.id}/stages/",
            {
                "name": "Разработка",
                "status": "in_progress",
                "order": 3,
                "responsible": self.responsible.id,
                "due_date": "2026-08-20",
            },
            format="json",
        )
        link_response = self.client.post(
            f"/api/projects/{deal.id}/links/",
            {
                "title": "Figma",
                "url": "https://example.com/figma",
                "description": "Макеты проекта",
            },
            format="json",
        )
        file_response = self.client.post(
            f"/api/projects/{deal.id}/files/",
            {
                "file_name": "brief.txt",
                "file": SimpleUploadedFile(
                    "brief.txt",
                    b"project brief",
                    content_type="text/plain",
                ),
            },
            format="multipart",
        )

        self.assertEqual(stage_response.status_code, 201)
        self.assertEqual(link_response.status_code, 201)
        self.assertEqual(file_response.status_code, 201)
        self.assertEqual(DealStage.objects.filter(deal=deal).count(), 1)
        self.assertEqual(DealLink.objects.filter(deal=deal).count(), 1)
        self.assertEqual(DealFile.objects.filter(deal=deal).count(), 1)

        response = self.client.get(f"/api/projects/{deal.id}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["current_stage_name"], "Разработка")
        self.assertEqual(response.data["stages"][0]["responsible"], self.responsible.id)
        self.assertEqual(response.data["links"][0]["title"], "Figma")
        self.assertEqual(response.data["files"][0]["file_name"], "brief.txt")

    def test_project_stage_status_can_be_patched(self):
        deal = self.create_project()
        stage = DealStage.objects.create(
            deal=deal,
            name="Разработка",
            status=DealStage.Status.PENDING,
            order=1,
        )

        response = self.client.patch(
            f"/api/projects/{deal.id}/stages/{stage.id}/",
            {"status": DealStage.Status.IN_PROGRESS},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], DealStage.Status.IN_PROGRESS)
        stage.refresh_from_db()
        self.assertEqual(stage.status, DealStage.Status.IN_PROGRESS)

    def create_project(self):
        deal = Deal.objects.create(
            name="CRM для «Алтын Маркет»",
            user=self.client_user,
            stage="active",
            date_start="2026-06-01",
            date_end="2026-08-20",
            deal_amount="2800000.00",
            payment_type="card",
        )
        deal.collaborators.add(self.client_user)
        deal.responsibles.add(self.responsible)
        return deal

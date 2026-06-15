from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from core.enums import UserRole
from src.deals.models import Deal


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

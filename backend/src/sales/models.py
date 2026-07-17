from django.db import models


class Lead(models.Model):
    lead_name = models.CharField(max_length=180)
    company = models.CharField(max_length=180)
    amount = models.DecimalField(max_digits=20, decimal_places=2)
    comments = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at", "-id")

    def __str__(self):
        return f"{self.lead_name} — {self.company}"

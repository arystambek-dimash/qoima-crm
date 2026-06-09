from django.db import models


# Create your models here.
class Income(models.Model):
    name = models.CharField(max_length=120)
    type = models.CharField(max_length=120)
    amount = models.DecimalField(decimal_places=2, max_digits=20)
    date_earned = models.DateField(auto_now_add=True, db_index=True)
    note = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ("-date_earned",)

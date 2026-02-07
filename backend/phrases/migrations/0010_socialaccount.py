from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('phrases', '0009_add_review_indexes'),
    ]

    operations = [
        migrations.CreateModel(
            name='SocialAccount',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('provider', models.CharField(choices=[('google', 'Google')], max_length=32)),
                ('provider_user_id', models.CharField(max_length=255)),
                ('email', models.EmailField(blank=True, max_length=254)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='social_accounts', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'unique_together': {('provider', 'provider_user_id')},
            },
        ),
        migrations.AddIndex(
            model_name='socialaccount',
            index=models.Index(fields=['provider', 'provider_user_id'], name='phrases_soc_provide_a47d22_idx'),
        ),
    ]

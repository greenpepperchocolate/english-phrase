from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('phrases', '0008_alter_usersetting_repeat_count'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='userprogress',
            index=models.Index(
                fields=['user', 'phrase', 'is_mastered'],
                name='idx_user_phrase_mastered'
            ),
        ),
        migrations.AddIndex(
            model_name='userprogress',
            index=models.Index(
                fields=['user', 'phrase', 'last_reviewed'],
                name='idx_user_phrase_reviewed'
            ),
        ),
    ]

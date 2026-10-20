FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN useradd --system --create-home --uid 10001 app && mkdir -p /app/media /app/staticfiles && chown -R app /app/media /app/staticfiles
USER app
ENV DJANGO_DEBUG=0
RUN DJANGO_SECRET_KEY=build-only python manage.py collectstatic --noinput
EXPOSE 8000
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn socusf.wsgi:application --bind 0.0.0.0:8000 --workers 3 --access-logfile -"]

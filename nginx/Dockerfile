FROM nginx:alpine

# Elimina la config por defecto de nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copia nuestra config dentro de la imagen
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Carpeta para los certificados SSL (el cliente los monta como volumen)
RUN mkdir -p /etc/nginx/ssl

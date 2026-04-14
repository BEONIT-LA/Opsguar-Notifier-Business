FROM postgres:16-alpine

# Copia todas las migraciones dentro de la imagen
# PostgreSQL las ejecuta automáticamente en orden alfabético
# la primera vez que se crea la base de datos
COPY 001_users.sql                   /docker-entrypoint-initdb.d/001_users.sql
COPY 002_audit_logs.sql              /docker-entrypoint-initdb.d/002_audit_logs.sql
COPY 003_seed.sql                    /docker-entrypoint-initdb.d/003_seed.sql
COPY 004_alter_users_add_profile.sql /docker-entrypoint-initdb.d/004_alter_users.sql
COPY 005_group_pools.sql             /docker-entrypoint-initdb.d/005_group_pools.sql

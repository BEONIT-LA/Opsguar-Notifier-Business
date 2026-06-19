FROM postgres:16-alpine

# Copia todas las migraciones dentro de la imagen
# PostgreSQL las ejecuta automáticamente en orden alfabético
# la primera vez que se crea la base de datos
COPY 001_users.sql                   /docker-entrypoint-initdb.d/001_users.sql
COPY 002_audit_logs.sql              /docker-entrypoint-initdb.d/002_audit_logs.sql
COPY 003_seed.sql                    /docker-entrypoint-initdb.d/003_seed.sql
COPY 004_alter_users_add_profile.sql /docker-entrypoint-initdb.d/004_alter_users.sql
COPY 005_group_pools.sql             /docker-entrypoint-initdb.d/005_group_pools.sql
COPY 006_tenants.sql                 /docker-entrypoint-initdb.d/006_tenants.sql
COPY 007_users_tenant.sql            /docker-entrypoint-initdb.d/007_users_tenant.sql
COPY 008_wa_sessions.sql             /docker-entrypoint-initdb.d/008_wa_sessions.sql
COPY 009_pools_tenant.sql            /docker-entrypoint-initdb.d/009_pools_tenant.sql
COPY 010_audit_tenant.sql            /docker-entrypoint-initdb.d/010_audit_tenant.sql
COPY 011_api_tokens.sql              /docker-entrypoint-initdb.d/011_api_tokens.sql

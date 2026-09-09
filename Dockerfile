FROM node:24-alpine AS frontend-build
WORKDIR /src/frontend/openslot-web
COPY frontend/openslot-web/package*.json ./
RUN npm ci
COPY frontend/openslot-web/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /src
COPY backend/OpenSlot.Api/OpenSlot.Api.csproj backend/OpenSlot.Api/
RUN dotnet restore backend/OpenSlot.Api/OpenSlot.Api.csproj
COPY backend/OpenSlot.Api/ backend/OpenSlot.Api/
RUN dotnet publish backend/OpenSlot.Api/OpenSlot.Api.csproj -c Release -o /out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
RUN mkdir -p /data
COPY --from=backend-build /out ./
COPY --from=frontend-build /src/frontend/openslot-web/dist ./wwwroot
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
VOLUME ["/data"]
ENTRYPOINT ["dotnet", "OpenSlot.Api.dll"]

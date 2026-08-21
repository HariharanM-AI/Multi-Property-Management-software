# PropertyOS — REST API Specification & Standards

## 1. Global API Standards
- **Base Route**: `/api/v1`
- **Protocol**: HTTPS (HTTP permitted in local development).
- **Request Payloads**: `Content-Type: application/json` or `multipart/form-data` (for media).
- **Authentication**: Secure HTTP-only cookies (`propertyos_session`) or `Authorization: Bearer <token>`.
- **Response Envelope**: Standard JSON envelope with `success`, `data`, `meta`, and `error`.

---

## 2. Authentication Endpoints (`/api/v1/auth`)
- `POST /api/v1/auth/register` (Public, Rate-limited)
- `POST /api/v1/auth/login` (Public, Rate-limited)
- `POST /api/v1/auth/logout` (Authenticated)
- `GET /api/v1/auth/me` (Authenticated)
- `POST /api/v1/auth/forgot-password` (Public, Rate-limited)
- `POST /api/v1/auth/reset-password` (Public, Rate-limited)

---

## 3. Organization Management (`/api/v1/organization`)
- `GET /api/v1/organization` (Permission: `organization.read`)
- `PATCH /api/v1/organization` (Permission: `organization.update`)

---

## 4. Team & Invitations (`/api/v1/team`, `/api/v1/invitations`)
- `GET /api/v1/team` (Permission: `team.read`)
- `PATCH /api/v1/team/:userId/role` (Permission: `team.update`)
- `POST /api/v1/team/:userId/deactivate` (Permission: `team.update`)
- `POST /api/v1/team/:userId/reactivate` (Permission: `team.update`)
- `DELETE /api/v1/team/:userId` (Permission: `team.remove`)
- `POST /api/v1/invitations` (Permission: `team.invite`)
- `GET /api/v1/invitations` (Permission: `team.read`)
- `POST /api/v1/invitations/accept` (Public, Rate-limited)
- `POST /api/v1/invitations/:id/resend` (Permission: `team.invite`)
- `DELETE /api/v1/invitations/:id` (Permission: `team.invite`)

---

## 5. Property Management (`/api/v1/properties`)

### 5.1 Amenities Catalog
- **Endpoint**: `GET /api/v1/properties/amenities`
- **Permission**: `property.read`
- **Response** (`200 OK`): List of 16 standard property amenities.

### 5.2 Create Property
- **Endpoint**: `POST /api/v1/properties`
- **Permission**: `property.create`
- **Rate Limit**: Applied (60 req / min)
- **Request Body**:
```json
{
  "name": "GreenGlen PG Residency",
  "propertyType": "PG",
  "description": "Premium co-living property in HSR Layout",
  "address": "#42, 14th Main Road, Sector 4",
  "locality": "HSR Layout",
  "city": "Bengaluru",
  "district": "Bengaluru Urban",
  "state": "Karnataka",
  "country": "India",
  "postalCode": "560102",
  "latitude": 12.9116,
  "longitude": 77.6389,
  "contactPhone": "9845012345",
  "contactEmail": "manager@greenglen.in",
  "amenityIds": ["wifi", "power_backup", "cctv"]
}
```
- **Response** (`201 Created`): Returns created property with assigned atomic reference code `PROP-000001` and resolved capabilities.

### 5.3 List Properties
- **Endpoint**: `GET /api/v1/properties`
- **Permission**: `property.read`
- **Query Parameters**:
  - `page` (default 1)
  - `pageSize` (default 10, max 100)
  - `propertyType` (`PG` | `RENTAL_HOUSE`)
  - `status` (`ACTIVE` | `ARCHIVED` | `INACTIVE`)
  - `city`
  - `search` (Search by property name, code, locality, or city)
- **Response** (`200 OK`): Paginated property list with `items`, `total`, `page`, `pageSize`, `totalPages`.

### 5.4 Get Property By ID
- **Endpoint**: `GET /api/v1/properties/:id`
- **Permission**: `property.read`
- **Response** (`200 OK`): Returns property details, configured amenities, media items, and model capabilities.

### 5.5 Update Property
- **Endpoint**: `PATCH /api/v1/properties/:id`
- **Permission**: `property.update`
- **Note**: `propertyType` (operating model) is **immutable** and cannot be altered.

### 5.6 Archive Property (Soft Delete)
- **Endpoint**: `POST /api/v1/properties/:id/archive`
- **Permission**: `property.delete`
- **Behavior**: Sets `status = 'ARCHIVED'` and `deletedAt = new Date()`. Hides property from standard listings. Writes `PROPERTY_ARCHIVED` audit log.

### 5.7 Restore Property
- **Endpoint**: `POST /api/v1/properties/:id/restore`
- **Permission**: `property.delete`
- **Behavior**: Clears `deletedAt = null` and sets `status = 'ACTIVE'`. Writes `PROPERTY_RESTORED` audit log.

### 5.8 Upload Property Media
- **Endpoint**: `POST /api/v1/properties/:id/media`
- **Permission**: `property.update`
- **Payload**: `multipart/form-data` with `file` (JPEG, PNG, WEBP, PDF) and optional `category` (`IMAGE` | `DOCUMENT` | `FLOOR_PLAN`).

### 5.9 Remove Property Media
- **Endpoint**: `DELETE /api/v1/properties/:id/media/:mediaId`
- **Permission**: `property.update`

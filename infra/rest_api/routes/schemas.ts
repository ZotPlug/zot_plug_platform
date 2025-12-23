/**
* @swagger
* components:
*   schemas:
*     Device:
*       type: object
*       required:
*         - name
*       properties:
*         id:
*           type: integer
*           description: The auto-generated id of the device
*           readOnly: true
*         name:
*           type: string
*           description: The name of the device
*         status:
*           type: string
*           description: The current state of the device 
*           enum: [online, offline, error]
*           example: offline
*         last_seen:
*           type: string
*           format: date
*           description: The last ping of the device 
*         empty_payload_count:
*           type: integer
*           description: Keeps track of the number of empty/malformed payloads received
*         is_faulty:
*           type: boolean
*           description: A flag used to mark devices as faulty.
*         is_deleted:
*           type: boolean
*           description: A flag used to mark devices as soft-deleted.
*         deleted_at:
*           type: string
*           format: date
*           description: Keeps track of when the device was soft-deleted.
*       example:
*         id: 12
*         name: Steve's Living Room
*         status: online
*         last_seen: 2020-03-10T04:05:06.157Z
*         empty_payload_count: 25
*         is_faulty: false
*         is_deleted: false
*     DeviceReading:
*       type: object
*       required:
*         - device_id
*         - voltage
*         - current
*       properties:
*         id:
*           type: integer
*           description: The auto-generated id of the power reading
*           readOnly: true
*         device_id:
*           type: integer
*           description: The id of the device it's associated with.
*           readOnly: true
*         voltage:
*           type: number
*           description: The measured voltage reading from the device in volts.
*         current:
*           type: number
*           description: The current reading from the device, measured in amps.
*         power:
*           type: number
*           description: Instantaneous power measured in watts.
*         cumulative_energy:
*           type: number
*           description: Cumulative energy measured in kWh.
*         recorded_at:
*           type: string
*           format: date
*           description: When the reading was taken.
*       example:
*         id: 212
*         device_id: 34
*         voltage: 118.6
*         current: 3.21
*         power: 380.7
*         cumulative_energy: 12
*         recorded_at: 2020-03-10T04:05:06.157Z
*     DeviceEnergyStat:
*       type: object
*       required:
*         - device_id
*         - period_type
*         - period_start
*       properties:
*         id:
*           type: integer
*           description: The auto-generated id of this aggregated energy usage per device over a specified time period.
*           readOnly: true
*         device_id:
*           type: integer
*           description: The id of the device it's associated with.
*           readOnly: true
*         period_type:
*           type: string
*           enum: [daily, weekly, monthly]
*           description: The start of the period (e.g. '2025-11.08')
*           example: daily
*         total_energy:
*           type: number
*           description: Total Wh used over the specified period.
*         avg_power:
*           type: number
*           description: The average power used over the specified period.
*         max_power:
*           type: number
*           description: The peak power used over the specified period.
*         updated_at:
*           type: string
*           format: date
*           description: Last time this was recalculated.
*       example:
*         id: 34
*         device_id: 12
*         period_type: daily
*         total_energy: 200
*         avg_power: 34
*         max_power: 54
*         updated_at: 2025-11-08
*     DevicePolicy:
*       type: object
*       required:
*         - device_id
*         - daily_energy_limit
*       properties:
*         id:
*           type: integer
*           description: The auto-generated id of this device's policy used for custom usage restrictions or automation rules.
*           readOnly: true
*         device_id:
*           type: integer
*           description: The id of the device it's associated with.
*           readOnly: true
*         daily_energy_limit:
*           type: number
*           description: Wh limit per day.
*         allowed_start:
*           type: string
*           format: date
*           description: Earliest allowed operation time
*         allowed_end:
*           type: string
*           format: date
*           description: Latest allowed operation time
*         is_enforced:
*           type: boolean
*           description: Whether the policy is active.
*         last_violation:
*           type: string
*           format: date
*           description: The last time the limit was exceeded
*         created_at:
*           type: string
*           format: date
*           description: When this policy was first created
*         updated_at:
*           type: string
*           format: date
*           description: When this policy was last updated
*       example:
*         id: 12
*         device_id: 12
*         daily_energy_limit: 1200
*         allowed_start: 04:05
*         allowed_end: 13:05
*         is_enforced: false
*         last_violation: 2025-11-06
*         created_at: 2025-11-04
*         updated_at: 2025-11-08
*/

/**
* @swagger
* components:
*   schemas:
*     User:
*       type: object
*       required:
*         - firstname
*         - lastname
*         - username
*         - email
*       properties:
*         id:
*           type: integer
*           description: The auto-generated id of the user
*           readOnly: true
*         firstname:
*           type: string
*           description: The user's first name
*         lastname:
*           type: string
*           description: The user's last name
*         username:
*           type: string
*           description: Login/display name (unique)
*         email:
*           type: string
*           description: Unique email (for login/auth or notifications)
*         email_verified:
*           type: boolean
*           description: Email verification (auth security)
*         phone:
*           type: string
*           description: Optional phone number
*         is_deleted:
*           type: boolean
*           description: Soft-delete flag (true if account is removed)
*         deleted_at:
*           type: string
*           format: date
*           description: Timestamp when user was soft-deleted
*         password:
*           type: string
*           description: Only used when adding a new user. Not stored in the database directly.
*       example:
*         id: 12
*         firstname: Bob
*         lastname: Jones
*         username: bobjonesman
*         email: bobjones@gmail.com
*         email_verified: true
*         is_deleted: true
*         deleted_at: 2020-03-10T04:05:06.157Z
*     Credentials:
*       type: object
*       required:
*         - email
*         - password
*       properties:
*         username:
*           type: string
*           description: The user's email.
*         password:
*           type: string
*           description: The user's password.
*       example:
*         username: bobjonesman
*         password: usersPassword
*/

/**
 * @swagger
 * components:
 *   schemas:
 *     MqttPublish:
 *       type: object
 *       required:
 *         - topic
 *       properties:
 *         topic:
 *           type: string
 *           description: MQTT topic name.
 *         payload:
 *           description: Can be object, string, or null.
 *           oneOf:
 *             - type: object
 *               additionalProperties: true
 *             - type: string
 *             - type: "null"
 *         qos:
 *           type: integer
 *           enum: [0, 1]
 *           description: MQTT QoS level (0 or 1).
 *         retain:
 *           type: boolean
 *           description: Whether to retain the last message on the broker.
 *       example:
 *         topic: "zotplug_000002/cmd/relay/on"
 *         payload:
 *           anyKeyValue: "Any string"
 *           tip: "This entire payload can be replaced via a String or Null. Does not need to be an object."
 *         qos: 0
 *         retain: false
 *
 *     PublishSuccess:
 *       type: object
 *       required:
 *         - ok
 *       properties:
 *         ok:
 *           type: boolean
 *           example: true
 *
 *     ErrorResponse:
 *       type: object
 *       required:
 *         - error
 *       properties:
 *         error:
 *           type: string
 *           example: "topic required"
 *
 *     UnkownErrRes:
 *       type: string
 */


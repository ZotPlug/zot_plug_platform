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

// infra/rest_api/routes/devices.ts
import { Router, Request, Response } from 'express'
import {
    getAllDevices,
    getDeviceById,
    getAllDevicesByUserId,
    getDeviceIdByName,
    getAllReadingsByDeviceName,
    getReadingsByDeviceNameInRange,
    getLatestReadingByDeviceName,
    getEnergyStatsByDeviceName,
    getDevicePolicy,
    getFaultyDevices,
    addDevice,
    addPowerReadingByDeviceName,
    updateDevice,
    deleteDevice,
} from '../../pg_db/queries/devices'

const router = Router()

//=========================================================
// READ
//=========================================================

/**
 * GET /api/devices/getAllDevices - list devices
 */

/**
* @swagger
* tags:
*   name: Devices
*   description: The device management API.
* /devices/getAllDevices:
*   get:
*     summary: Get all devices that haven't been deleted
*     tags: [Devices]
*     responses:
*       200:
*         description: The returned devices sorted by ID.
*         content:
*           application/json:
*             schema:
*               type: array
*               items:
*                 $ref: '#/components/schemas/Device'
*       500:
*         description: Failed to fetch devices.
*/
router.get('/getAllDevices', async (req: Request, res: Response) => {
    try {
        const devices = await getAllDevices()
        res.json(devices)

    } catch (err) {
        console.error('Get device error: ', err)
        res.status(500).json({ error: 'Failed to fetch devices' })
    }
})

/**
 * GET /api/devices/getDeviceById/:id
 */

/**
* @swagger
* /devices/getDeviceById/{id}:
*   get:
*     summary: Get a device by a specific id.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: id
*         schema:
*           type: integer
*         required: true
*         description: The ID of the device to retrieve
*     responses:
*       200:
*         description: The device was found.
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/Device'
*       400:
*         description: Invalid device id.
*       404:
*         description: Device not found.
*       500:
*         description: Failed to fetch device.
*/
router.get('/getDeviceById/:id', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id)
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' })

        const device = await getDeviceById(id)
        if (!device) return res.status(404).json({ error: 'Device not found' })

        res.json(device)

    } catch (err) {
        console.error('Get device by ID error: ', err)
        res.status(500).json({ error: 'Failed to fetch device' })
    }
})

/**
 * GET /api/devices/getAllDevicesByUserId/:id - get all devices by user ID
 */

/**
* @swagger
* /devices/getAllDevicesByUserId/{id}:
*   get:
*     summary: Get ll devices associated with a user ID.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: id
*         schema:
*           type: integer
*         required: true
*         description: The ID of the user whose devices we are looking for.
*     responses:
*       200:
*         description: The device was found.
*         content:
*           application/json:
*             schema:
*               type: array
*               items:
*                 $ref: '#/components/schemas/Device'
*       400:
*         description: Invalid user id.
*       404:
*         description: No devices found for this user.
*       500:
*         description: Failed to fetch devices.
*/
router.get('/getAllDevicesByUserId/:id', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id)
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' })


        const devices = await getAllDevicesByUserId(id)
        if (devices.length === 0) return res.status(404).json({ error: 'No devices found for this user' })

        res.json(devices)

    } catch (err) {
        console.error('Get devices by user ID error: ', err)
        res.status(500).json({ error: 'Failed to fetch devices' })
    }
})

/**
 * GET /api/devices/getDeviceIdByName/:deviceName
 */

/**
* @swagger
* /devices/getDeviceIdByName/{deviceName}:
*   get:
*     summary: Get a device by name.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: deviceName
*         schema:
*           type: string
*         required: true
*         description: The name of the device to retrieve
*     responses:
*       200:
*         description: The device was found.
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 deviceName:
*                   type: string
*                 id:
*                   type: integer
*       400:
*         description: Missing device name.
*       404:
*         description: Device not found.
*       500:
*         description: Failed to fetch device ID.
*/
router.get('/getDeviceIdByName/:deviceName', async (req: Request, res: Response) => {
    try {
        const deviceName = req.params.deviceName
        if (!deviceName) return res.status(400).json({ error: 'Missing device name' })

        const deviceId = await getDeviceIdByName(deviceName)
        if (!deviceId) return res.status(404).json({ error: 'Device not found' })

        res.json({ deviceName, id: deviceId })

    } catch (err) {
        console.error('Get device ID by name error:', err)
        res.status(500).json({ error: 'Failed to fetch device ID' })
    }
})

/**
 * GET /api/devices/getReadingsByDeviceName/:deviceName
 */

/**
* @swagger
* /devices/getReadingsByDeviceName/{deviceName}:
*   get:
*     summary: Get the readings associated with a device by its device name.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: deviceName
*         schema:
*           type: string
*         required: true
*         description: The name of the device to retrieve
*     responses:
*       200:
*         description: The readings associated with the device name.
*         content:
*           application/json:
*             schema:
*               type: array
*               items:
*                 $ref: '#/components/schemas/DeviceReading'
*       404:
*         description: Device not found.
*       500:
*         description: Failed to fetch readings.
*/
router.get('/getReadingsByDeviceName/:deviceName', async (req: Request, res: Response) => {
    try {
        const { deviceName } = req.params

        const readings = await getAllReadingsByDeviceName(deviceName)
        if (!readings) return res.status(404).json({ error: 'Device not found' })

        res.json(readings)

    } catch (err) {
        console.error('Get readings by device error:', err)
        res.status(500).json({ error: 'Failed to fetch readings' })
    }
})

/**
 * GET /api/devices/getReadingsByDeviceNameInRange/:deviceName
 */

/**
* @swagger
* /devices/getReadingsByDeviceNameInRange/{deviceName}:
*   get:
*     summary: Get the readings associated with a device by its device name within a specified time range (from-to ISO timestamps).
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: deviceName
*         schema:
*           type: string
*         required: true
*         description: The name of the device to lookup data for.
*       - in: query
*         name: from
*         schema:
*           type: string
*         required: true
*         description: The starting time (ISO timestamps)
*       - in: query
*         name: to
*         schema:
*           type: string
*         required: true
*         description: The ending time (ISO timestamps)
*     responses:
*       200:
*         description: The readings associated with the device name.
*         content:
*           application/json:
*             schema:
*               type: array
*               items:
*                 $ref: '#/components/schemas/DeviceReading'
*       400:
*         description: Missing from or to query parameters.
*       404:
*         description: Device not found.
*       500:
*         description: Failed to fetch readings by device in range.
*/
router.get('/getReadingsByDeviceNameInRange/:deviceName', async (req: Request, res: Response) => {
    try {
        const { deviceName } = req.params
        const { from, to } = req.query

        if (!from || !to)
            return res.status(400).json({ error: 'Missing from or to query parameters' })

        const readings = await getReadingsByDeviceNameInRange(deviceName, from as string, to as string)
        if (!readings) return res.status(404).json({ error: 'Device not found' })
        
        res.json(readings)
    
    } catch (err) {
        console.error('Get readings by device in range error:', err)
        res.status(500).json({ error: 'Failed to fetch readings' })
    }
})

/**
 * GET /api/devices/getLatestReading/:deviceName
 */

/**
* @swagger
* /devices/getLatestReading/{deviceName}:
*   get:
*     summary: Get the latest reading associated with a device by its device name.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: deviceName
*         schema:
*           type: string
*         required: true
*         description: The name of the device to retrieve
*     responses:
*       200:
*         description: The readings associated with the device name.
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/DeviceReading'
*       404:
*         description: No readings found.
*       500:
*         description: Failed to fetch device reading.
*/
router.get('/getLatestReading/:deviceName', async (req: Request, res: Response) => {
    try {
        const { deviceName } = req.params
        const latest = await getLatestReadingByDeviceName(deviceName)
        if (!latest) return res.status(404).json({ error: 'No readings found' })
        res.json(latest)
    } catch (err) {
        console.error('Get latest reading error:', err)
        res.status(500).json({ error: 'Failed to fetch latest reading' })
    }
})

/**
* @swagger
* /devices/getEnergyStats/{deviceName}/{periodType}/{periodStart}:
*   get:
*     summary: Get the aggregate energy stats associated with a specific device name for a particular duration based on a given start time.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: deviceName
*         schema:
*           type: string
*         required: true
*         description: The name of the device to retrieve
*       - in: path
*         name: periodType
*         schema:
*           type: string
*         required: true
*         description: The type of period. (e.g. daily, weekly, monthly)
*       - in: path
*         name: periodStart
*         schema:
*           type: string
*         required: true
*         description: The starting time for this period
*     responses:
*       200:
*         description: The aggregated energy usage associated with the device name over a defined time period.
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/EnergyDeviceStat'
*       404:
*         description: Device or stats not found.
*       500:
*         description: Failed to fetch energy stats.
*/
router.get('/getEnergyStats/:deviceName/:periodType/:periodStart', async (req: Request, res: Response) => {
    try {
        const { deviceName, periodType, periodStart } = req.params
        const stats = await getEnergyStatsByDeviceName(deviceName, periodType as any, periodStart)
        if (!stats) return res.status(404).json({ error: 'Device or stats not found' })
        res.json(stats)
    } catch (err) {
        console.error('Get energy stats error:', err)
        res.status(500).json({ error: 'Failed to fetch energy stats' })
    }
})

/**
* @swagger
* /devices/getDevicePolicy/{deviceName}:
*   get:
*     summary: Get the device policy associated with this device by its device name.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: deviceName
*         schema:
*           type: string
*         required: true
*         description: The name of the device to retrieve
*     responses:
*       200:
*         description: The policy associated with the device name.
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/DevicePolicy'
*       404:
*         description: No policy found.
*       500:
*         description: Failed to fetch device policy.
*/
router.get('/getDevicePolicy/:deviceName', async (req: Request, res: Response) => {
    try {
        const { deviceName } = req.params
        const policy = await getDevicePolicy(deviceName)
        if (!policy) return res.status(404).json({ error: 'No policy found' })
        res.json(policy)
    } catch (err) {
        console.error('Get device policy error:', err)
        res.status(500).json({ error: 'Failed to fetch device policy' })
    }
})


/**
 * GET /api/devices/getFaultyDevices - list faulty devices
 */

/**
* @swagger
* /devices/getAllDevices:
*   get:
*     summary: Get all faulty devices that haven't been deleted
*     tags: [Devices]
*     responses:
*       200:
*         description: The returned devices sorted by last seen.
*         content:
*           application/json:
*             schema:
*               type: array
*               items:
*                 $ref: '#/components/schemas/Device'
*       500:
*         description: Failed to fetch devices.
*/
router.get('/getFaultyDevices', async (_req: Request, res: Response) => {
    try {
        const faultyDevices = await getFaultyDevices()
        res.json(faultyDevices)
    } catch (err) {
        console.error('Get faulty devices error:', err)
        res.status(500).json({ error: 'Failed to fetch faulty devices' })
    }
})




//=========================================================
// CREATE
//=========================================================

/**
 * POST /api/devices/addDeviceMap - create device and map owner
 */

/**
* @swagger
* /devices/addDeviceMap:
*   post:
*     summary: Create device and map owner
*     tags: [Devices]
*     requestBody:
*       required: true
*       content:
*         application/json:
*             schema:
*               type: object
*               properties:
*                 deviceName:
*                   type: string
*                 userId:
*                   type: integer
*     responses:
*       201:
*         description: The user was created.
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/Device'
*       400:
*         description: Missing name or user id.
*       409:
*         description: Device name already exists.
*       500:
*         description: Failed to create device.
*
*/
router.post('/addDeviceMap', async (req: Request, res: Response) => {
    try {
        const { deviceName, userId } = req.body
        if (!deviceName || !userId) 
            return res.status(400).json({ error: 'Missing name or userId' })

        const device = await addDevice({ deviceName, userId })
        res.status(201).json(device)

    } catch (err: any) {
        if (err?.code === '23505') 
            return res.status(409).json({ error: 'Device name already exists' })
        
        console.error('Failed to create device', err)
        res.status(500).json({ error: 'Failed to create device' })

    }
})


//=========================================================
// UPDATE
//=========================================================

/**
 * PUT /api/devices/updateDevice/:id - partial update
 */
 
/**
* @swagger
* /devices/updateDevice/{id}:
*   put:
*     summary: Update info related to the device.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: id
*         schema:
*           type: integer
*         required: true
*         description: The id of the device to update.
*     requestBody:
*       required: true
*       content:
*         application/json:
*             schema:
*               type: object
*               properties:
*                 name:
*                   type: string
*                 status:
*                   type: string
*                 last_seen:
*                   type: string
*                   format: date
*     responses:
*       200:
*         description: The updated device data.
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/Device'
*       400:
*         description: Invalid ID.
*       404:
*         description: Device not found or no changes applied.
*       500:
*         description: Failed to update device.
*/
router.put('/updateDevice/:id', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id)
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' })

        const payload: any = {}
        if (req.body.name !== undefined) payload.name = req.body.name

        if (req.body.status !== undefined) payload.status = req.body.status

        if (req.body.last_seen !== undefined) payload.last_seen = req.body.last_seen

        payload.id = id

        const updated = await updateDevice(payload)
        if (!updated) return res.status(404).json({ error: 'Device not found or no changes applied' })

        res.json(updated)

    } catch (err) {
        console.error('Update device error: ', err)
        res.status(500).json({ error: 'Failed to update device' })
    }
})

function ensureLatestReading(latest: any, deviceName: string) {
    
    // if no prior reading, seed one with zero values
    if (!latest) {
        console.warn(`[INFO] No previous reading found for ${deviceName}. Creating initial record.`)
        return { voltage: 0, current: 0, power: 0, cumulative_energy: 0, recorded_at: new Date().toISOString() }
    }
    
    return latest
}


/**
 * PUT /api/devices/updateEnergyUsage/:deviceName
 */

/**
* @swagger
* /devices/updateEnergyUsage/{deviceName}:
*   put:
*     summary: Update the energy usage statistics associated with this device.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: deviceName
*         schema:
*           type: string
*         required: true
*         description: The name of the device to update.
*     requestBody:
*       required: true
*       content:
*         application/json:
*             schema:
*               type: object
*               properties:
*                 cumulativeEnergy:
*                   type: number
*     responses:
*       200:
*         description: The new device reading entry.
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/DeviceReading'
*       400:
*         description: Missing device name or cumulative energy.
*       500:
*         description: Failed to update energy usage.
*/
router.put('/updateEnergyUsage/:deviceName', async (req: Request, res: Response) => {
    try {
        const { deviceName } = req.params
        const { cumulativeEnergy } = req.body

        if (!deviceName || cumulativeEnergy === undefined) 
            return res.status(400).json({ error: 'Missing deviceName or cumulativeEnergy' })

        let latest = ensureLatestReading(await getLatestReadingByDeviceName(deviceName), deviceName)

        const updated = await addPowerReadingByDeviceName({
            deviceName,
            voltage: latest.voltage,
            current: latest.current,
            power: latest.power,
            cumulativeEnergy,
            recordedAt: new Date().toISOString()
        })

        res.json(updated)

    } catch (err) {
        console.error('Update energy usage error:', err)
        res.status(500).json({ error: 'Failed to update energy usage' })
    }
})

/**
 * PUT /api/devices/updatePower/:deviceName
 */

/**
* @swagger
* /devices/updatePower/{deviceName}:
*   put:
*     summary: Update the power readings associated with this device.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: deviceName
*         schema:
*           type: string
*         required: true
*         description: The name of the device to update.
*     requestBody:
*       required: true
*       content:
*         application/json:
*             schema:
*               type: object
*               properties:
*                 power:
*                   type: number
*     responses:
*       200:
*         description: The new device reading entry.
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/DeviceReading'
*       400:
*         description: Missing device name or power.
*       500:
*         description: Failed to update power.
*/
router.put('/updatePower/:deviceName', async (req: Request, res: Response) => {
    try {
        const { deviceName } = req.params
        const { power } = req.body

        if (!deviceName || power === undefined) 
            return res.status(400).json({ error: 'Missing deviceName or power' })

        let latest = ensureLatestReading(await getLatestReadingByDeviceName(deviceName), deviceName)


        const updated = await addPowerReadingByDeviceName({
            deviceName,
            voltage: latest.voltage,
            current: latest.current,
            power,
            cumulativeEnergy: latest.cumulative_energy,
            recordedAt: new Date().toISOString()
        })

        res.json(updated)

    } catch (err) {
        console.error('Update power error:', err)
        res.status(500).json({ error: 'Failed to update power' })
    }
})

/**
 * PUT /api/devices/updateCurrent/:deviceName
 */
 
/**
* @swagger
* /devices/updateReadings/{deviceName}:
*   put:
*     summary: Update the current and voltage readings associated with this device.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: deviceName
*         schema:
*           type: string
*         required: true
*         description: The name of the device to update.
*     requestBody:
*       required: true
*       content:
*         application/json:
*             schema:
*               type: object
*               properties:
*                 current:
*                   type: number
*                 voltage:
*                   type: number
*     responses:
*       200:
*         description: The new device reading entry.
*         content:
*           application/json:
*             schema:
*               $ref: '#/components/schemas/DeviceReading'
*       400:
*         description: Missing device name or current.
*       500:
*         description: Failed to update current.
*/
router.put('/updateReadings/:deviceName', async (req: Request, res: Response) => {
    try {
        const { deviceName } = req.params
        const { current, voltage } = req.body
        
        if (!deviceName || current === undefined || voltage === undefined) 
            return res.status(400).json({ error: 'Missing deviceName, current, or voltage' })

        let latest = ensureLatestReading(await getLatestReadingByDeviceName(deviceName), deviceName)

        const updated = await addPowerReadingByDeviceName({
            deviceName,
            voltage,
            current,
            power: latest.power,
            cumulativeEnergy: latest.cumulative_energy,
            recordedAt: new Date().toISOString()
        })

        res.json(updated)

    } catch (err) {
        console.error('Update current error:', err)
        res.status(500).json({ error: 'Failed to update current' })
    }
})



//=========================================================
// DELETE
//=========================================================

/**
 * DELETE /api/devices/deleteDevice/:id - soft delete
 */

/**
* @swagger
* /devices/deleteDevice/{id}:
*   delete:
*     summary: Deletes a given device from the database.
*     tags: [Devices]
*     parameters:
*       - in: path
*         name: id
*         schema:
*           type: integer
*         required: true
*         description: The id of the device to delete.
*     responses:
*       200:
*         description: The id of the soft-deleted device.
*         content:
*           application/json:
*             schema:
*               type: object
*               properties:
*                 id:
*                   type: integer
*       400:
*         description: Invalid id.
*       404:
*         description: Device not found.
*       500:
*         description: Failed to delete the device.
*/
router.delete('/deleteDevice/:id', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id)
        if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' })

        const deleted = await deleteDevice(id)
        if (!deleted) return res.status(404).json({ error: 'Device not found' })

        res.json(deleted)
    } catch (err) {
        console.error('Delete device error', err)
        res.status(500).json({ error: 'Failed to delete device' })
    }
})

export default router

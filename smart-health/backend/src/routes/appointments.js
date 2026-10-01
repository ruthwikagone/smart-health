const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/appointmentController');

router.use(authenticate);

router.post('/',
  [
    body('center_id').notEmpty().withMessage('center_id is required'),
    body('issue').trim().notEmpty().withMessage('Issue/reason is required'),
    body('appointment_date').isDate().withMessage('Valid date required'),
    body('appointment_time').matches(/^\d{2}:\d{2}$/).withMessage('Valid time required (HH:MM)'),
    body('consultation_type').optional().isIn(['in_person', 'telemedicine']).withMessage('Valid consultation type required'),
  ],
  validate, ctrl.createAppointment
);

router.get('/me', ctrl.getMyAppointments);
router.get('/:id', ctrl.getAppointmentById);
router.patch('/:id/reschedule',
  [
    body('appointment_date').isDate(),
    body('appointment_time').matches(/^\d{2}:\d{2}$/),
  ],
  validate, ctrl.rescheduleAppointment
);
router.patch('/:id/cancel', ctrl.cancelAppointment);

module.exports = router;

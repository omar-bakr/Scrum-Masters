
const Joi = require('joi') 
const User = require('../models/User') 
var Company = require('../models/company') 
var Comment = require('../models/comment') 
var Notification = require('../models/Notification') 


function validatecommnet(comment) {
  const schema = {
    comment_text: Joi.string().required(),
    application_id: Joi.string().required(),
    user_id: Joi.string().required()
  } 
  return Joi.validate(comment, schema) 
}

function validateUser(user, creating) {
  const schema = {
    firstName: Joi.string()
      .max(30)
      .required(),
    lastName: Joi.string()
      .max(30)
      .required(),
    password: Joi.string()
      .min(8)
      .max(30)
      .required(),
    gender: Joi.string()
      .valid(['male', 'female'])
      .required()
  } 
  if (creating) {
    Object.assign(schema, {
      email: Joi.string()
        .email()
        .required(),
      type: Joi.string()
        .valid(['investor', 'lawyer', 'reviewer', 'admin'])
        .required()
    }) 
  }

  return Joi.validate(user, schema) 
}

exports.listAllUsers = (req, res) => {
  User.find({}, { _id: true })
    .then(users => {
      return res.json({ data: users }) 
    })
    .catch(err => {
      console.log(err) 
      return res.sendStatus(500) 
    }) 
} 

exports.getUser = (req, res) => {
  User.findById(req.params.id)
    .then(user => {
      if (!user) return res.status(404).send('User not found') 
      return res.json(user) 
    })
    .catch(err => {
      console.log(err) 
      return res.sendStatus(500) 
    }) 
} 

exports.createUser = (req, res) => {
  const { error } = validateUser(req.body, true) 
  if (error) return res.status(400).send(error.details[0].message) 

  User.findOne({ email: req.body.email })
    .then(user => {
      if (user)
        return res
          .status(400)
          .send('A user is already registered with this email') 

      var user = req.body 
      User.create(user)
        .then(user => {

          return res.json({ msg: 'User created', data: user }) 

        })
        .catch(err => {
          console.log(err) 
          return res.sendStatus(500) 
        }) 
    })
    .catch(err => {
      console.log(err) 
      return res.sendStatus(500) 
    }) 
} 

exports.updateUser = (req, res) => {
  const { error } = validateUser(req.body, false) 
  if (error) return res.status(400).send(error.details[0].message) 

  User.findByIdAndUpdate(req.params.id, req.body, { new: false })
    .then(user => {

      if (!user) return res.status(404).send('User not found') 
      return res.json({ msg: 'User updated', data: user }) 

    })
    .catch(err => {
      console.log(err) 
      return res.sendStatus(500) 
    }) 
} 

exports.deleteUser = (req, res) => {
  User.findByIdAndRemove(req.params.id)
    .then(user => {

      if (!user) return res.status(404).send('User not found') 
      return res.json({ msg: 'User deleted', data: user }) 
    })
    .catch(err => {
      console.log(err) 
      return res.sendStatus(500) 
    }) 
} 
// add comment on a specific company application

exports.createComment = (req, res) => {
  let { comment_text, application_id, user_id } = req.body 
  if (!(comment_text && application_id && user_id)) return res.sendStatus(400) 
  const { error } = validatecommnet(req.body) 
  if (error) return res.status(400).send(error.details[0].message) 

  let comment = {} 
  comment.comment_date = new Date() 
  comment.comment_text = comment_text 
  comment.application_id = application_id 
  comment.user_id = user_id 

  Comment.create(comment)
    .then(comment => {
      Company.findOneAndUpdate(
        { _id: application_id },
        { $push: { comments: comment._id } }
      )
        .then(() => {
          return res.json({ comment: comment }) 
        })
        .catch(err => {
          console.log(
            'Internal server error while adding comment to company list: \n',
            err,
            '\n\n'
          ) 
          return res.sendStatus(500) 
        }) 
    })
    .catch(err => {
      console.log(
        'Internal server error while creating commnet: \n',
        err,
        '\n\n'
      ) 
      return res.sendStatus(500) 
    }) 
} 

exports.updateComment = async (req, res) => {
  const comment_id = req.params.id 
  const comment_text = req.body.comment_text 
  if (!comment_text) return res.send({ error: 'comment text is required' }) 
  if (typeof comment_text !== 'string') {
    return res.status(400).send({ err: 'Invalid value for comment text' }) 
  }
  const comment = await Comment.findByIdAndUpdate(
    comment_id,
    { comment_text: comment_text },
    { new: true }
  ) 

  if (!comment) return res.status(400).send({ error: 'comment not found' }) 

  return res.status(200).send(comment) 
} 

exports.deleteComment = async (req, res) => {
  const application_id = req.params.app_id 
  const comment_id = req.params.comm_id 
  const deletedcomment = await Comment.findByIdAndRemove(comment_id) 
  if (!deletedcomment)
    return res.status(404).send({ error: 'comment not found ' }) 

  const targetapplication = await Company.findById(application_id) 
  if (!targetapplication)
    return res.status(404).send({ error: 'application not found ' }) 
  var deletedComment = targetapplication.comments.remove(comment_id) 
  return res.send(deletedComment) 
} 

exports.viewComments = async (req, res) => {
  const application_id = req.params.id 
  const targetapplication = await Company.findById(application_id).populate({
    path: 'comments',
    model: 'comment'
  }) 
  if (!targetapplication)
    return res.status(404).send({ error: 'application not found' }) 

  return res.json(targetapplication.comments) 
} 

// This is a helper method which will be used whenever a notification needs to be created
exports.createNotificationForUser = async notification => {
  try {
    const notif_obj = await Notification.create(notification) 
    if (!notif_obj) return undefined 

    await User.findOneAndUpdate(
      { _id: notif_obj.owner_id },
      { $push: { notifications: notif_obj._id } }
    ) 
    return notif_obj 
  } catch (err) {
    console.log(err) 
    return undefined 
  }
} 

exports.getNotifications = async (req, res) => {
  User.findById(req.params.id)
    .populate({
      path: 'notifications',
      model: 'notification'
    })
    .then(user => {
      if (!user) return res.status(404).send({ error: 'User not found' }) 
      return res.json(user.notifications) 
    })
    .catch(err => {
      console.log(err) 
      return res.sendStatus(500) 
    }) 
} 

exports.setNotificationViewed = async (req, res) => {
  Notification.findByIdAndUpdate(req.params.id, { viewed: true }, { new: true })
    .then(notification => {
      if (!notification)
        return res.status(404).send({ error: 'Notification not found' }) 
      return res.json({ msg: 'Success', data: notification }) 
    })
    .catch(err => {
      console.log(err) 
      return res.sendStatus(500) 
    })
} 

exports.notificationTestCreate = async (req, res) => {
  const notif = await exports.createNotificationForUser(req.body) 
  console.log(notif) 
  if (!notif) res.sendStatus(500) 
  return res.json(notif) 
} 

exports.viewApplicationFees = async (req, res) => {
  const targetId = req.params.id 
  const targetApplication = await Company.findById(targetId) 
  if (!targetApplication)
    return res.status(404).send({ error: 'Application not found' }) 

  const applicationFees = targetApplication.fees 
  if (!applicationFees)
    return res.send({ error: 'The fees is not calculated yet' }) 

  return res.send({ Fees: applicationFees }) 
} 

exports.assignReviewer = async (req, res) => {
  const targetId = req.params.app_id 
  const reviewer_id = req.params.rev_id 

  var targetApplication = await Company.findById(targetId) 

  if (!targetApplication)
    return res.status(404).send({ error: 'Application not found' }) 

  var targetReviewer = await User.findById(reviewer_id) 

  if (!targetReviewer)
    return res.status(404).send({ error: 'Reviewer not found' }) 
  if (targetReviewer.type != 'reviewer')
    return res
      .status(404)
      .send({ error: 'the assigned user should be reviewer' }) 
  if (targetApplication.reviewed_statusreviewer)
    return res.send({ error: 'this application is already reviewed' }) 

  const targetApplicationup = await Company.findByIdAndUpdate(
    targetId,
    { review_reviewer: reviewer_id },
    { new: true }
  ) 

  return res.send(targetApplicationup) 
} 
exports.assignLaywer = async (req, res) => {
  const appId = req.params.appId 
  const lawyerId = req.params.lawyerId 

  var application = await Company.findById(appId) 
  if (!application)
    return res.status(404).send({ error: 'Application not found' }) 

  var lawyer = await User.findById(lawyerId) 
  if (!lawyer) return res.status(404).send({ error: 'Lawyer not found' }) 
  if (lawyer.type != 'lawyer')
    return res
      .status(400)
      .send({ error: 'the user you are assigning is not of type (lawyer)' }) 

  if (application.review_lawyer)
    return res.status(400).send({
      error: 'A lawyer is already assigned to this application'
    }) 
  const updatedApplication = await Company.findByIdAndUpdate(
    appId,
    { review_lawyer: lawyerId },
    { new: true }
  ) 

  notification = {} 
  notification.owner_id = lawyerId 
  notification.target_type = 'company' 
  notification.target_id = appId 
  notification.notif_text = 'You Were Assigned To An Application' 

  Notification.create(notification)
    .then(notification => {
      User.findOneAndUpdate(
        { _id: lawyerId },
        { $push: { notifications: notification._id } }
      )
        .then(() => {
          return res.json({
            msg: 'Lawyer Assigned Successfully And A Notification Was Sent',
            data: notification
          }) 
        })
        .catch(err => {
          console.log(
            'Internal server error while adding comment to company list: \n',
            err,
            '\n\n'
          ) 
          return res.sendStatus(500) 
        }) 
    })
    .catch(err => {
      console.log(
        'Internal server error while creating commnet: \n',
        err,
        '\n\n'
      ) 
      return res.sendStatus(500) 
    }) 
}

exports.getassignedlawyer = async(req,res) => {
  const companyrequest=await CompanyRequest.findOne({_id:req.params.companyid,investor_id:req.params.userid})
  if(!companyrequest)
     return res.status(404).send({ error: 'No such Request'})
  if(!companyrequest.assigned)
     return res.status(404).send({ error: 'lawyer is not assigned yet'})   
  const laywer=await User.findOne({_id:companyrequest.lawyer_id},{_id:false,firstName:true,lastName:true,email:true})
  if(!laywer)
     return res.status(404).send({ error: 'No such lawyer'})
  return res.json(laywer) 
}

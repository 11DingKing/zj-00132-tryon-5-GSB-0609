function splitTags(str) {
  return str ? str.split(',') : [];
}

function serializeModel(model) {
  if (!model) return null;
  return {
    ...model,
    styleTags: splitTags(model.styleTags),
  };
}

function serializeReview(review) {
  return {
    ...review,
    tags: splitTags(review.tags),
  };
}

function serializeReviews(reviews) {
  return reviews.map(serializeReview);
}

function serializeTask(task) {
  return {
    ...task,
    model: serializeModel(task.model),
    reviews: serializeReviews(task.reviews || []),
  };
}

function serializeTasks(tasks) {
  return tasks.map(serializeTask);
}

function serializeModels(models) {
  return models.map(serializeModel);
}

module.exports = {
  splitTags,
  serializeModel,
  serializeReview,
  serializeReviews,
  serializeTask,
  serializeTasks,
  serializeModels,
};

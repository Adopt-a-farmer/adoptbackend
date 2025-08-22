const KnowledgeArticle = require('../models/KnowledgeArticle');
const FarmingCalendar = require('../models/FarmingCalendar');

// @desc    Get knowledge articles
// @route   GET /api/knowledge/articles
// @access  Public
const getKnowledgeArticles = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const filter = { status: 'published' };
    
    if (req.query.category) {
      filter.category = req.query.category;
    }
    
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }
    
    if (req.query.difficulty) {
      filter.difficulty = req.query.difficulty;
    }

    let sort = { publishedAt: -1 };
    if (req.query.sort === 'views') {
      sort = { views: -1 };
    } else if (req.query.sort === 'likes') {
      sort = { 'likes.length': -1 };
    }

    const articles = await KnowledgeArticle.find(filter)
      .populate('author', 'firstName lastName avatar role')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await KnowledgeArticle.countDocuments(filter);

    res.json({
      success: true,
      data: {
        articles,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get knowledge articles error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get single knowledge article
// @route   GET /api/knowledge/articles/:id
// @access  Public
const getKnowledgeArticle = async (req, res) => {
  try {
    const article = await KnowledgeArticle.findById(req.params.id)
      .populate('author', 'firstName lastName avatar role')
      .populate('comments.user', 'firstName lastName avatar')
      .populate('comments.replies.user', 'firstName lastName avatar');

    if (!article || article.status !== 'published') {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    // Increment view count
    article.views += 1;
    await article.save();

    res.json({
      success: true,
      data: { article }
    });
  } catch (error) {
    console.error('Get knowledge article error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create knowledge article
// @route   POST /api/knowledge/articles
// @access  Private (Expert/Admin only)
const createKnowledgeArticle = async (req, res) => {
  try {
    const articleData = {
      ...req.body,
      author: req.user._id,
      slug: req.body.title.toLowerCase().replace(/[^a-zA-Z0-9]/g, '-'),
      isExpert: req.user.role === 'expert' || req.user.role === 'admin'
    };

    // Auto-publish if user is admin or expert
    if (req.user.role === 'admin' || req.user.role === 'expert') {
      articleData.status = 'published';
      articleData.publishedAt = new Date();
    }

    const article = await KnowledgeArticle.create(articleData);

    res.status(201).json({
      success: true,
      message: 'Article created successfully',
      data: { article }
    });
  } catch (error) {
    console.error('Create knowledge article error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Like/Unlike article
// @route   POST /api/knowledge/articles/:id/like
// @access  Private
const toggleArticleLike = async (req, res) => {
  try {
    const articleId = req.params.id;
    const userId = req.user._id;

    const article = await KnowledgeArticle.findById(articleId);
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    const existingLike = article.likes.find(like => like.user.toString() === userId.toString());

    if (existingLike) {
      // Remove like
      article.likes = article.likes.filter(like => like.user.toString() !== userId.toString());
    } else {
      // Add like
      article.likes.push({ user: userId });
    }

    await article.save();

    res.json({
      success: true,
      message: existingLike ? 'Article unliked' : 'Article liked',
      data: {
        liked: !existingLike,
        likesCount: article.likes.length
      }
    });
  } catch (error) {
    console.error('Toggle article like error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get farming calendar
// @route   GET /api/knowledge/calendar
// @access  Public
const getFarmingCalendar = async (req, res) => {
  try {
    const { region, month, category, crop, livestock } = req.query;

    const filter = { isActive: true };
    
    if (region) filter.region = region;
    if (month) filter['timing.month'] = parseInt(month);
    if (category) filter.category = category;
    if (crop) filter.cropType = { $in: [crop] };
    if (livestock) filter.livestockType = { $in: [livestock] };

    const calendar = await FarmingCalendar.find(filter)
      .populate('createdBy', 'firstName lastName role')
      .populate('expertAdvice.author', 'firstName lastName avatar')
      .sort({ priority: -1, 'timing.month': 1, 'timing.week': 1 });

    // Group by month for better organization
    const calendarByMonth = {};
    calendar.forEach(item => {
      const month = item.timing.month;
      if (!calendarByMonth[month]) {
        calendarByMonth[month] = [];
      }
      calendarByMonth[month].push(item);
    });

    res.json({
      success: true,
      data: {
        calendar,
        calendarByMonth
      }
    });
  } catch (error) {
    console.error('Get farming calendar error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Create calendar entry
// @route   POST /api/knowledge/calendar
// @access  Private (Expert/Admin only)
const createCalendarEntry = async (req, res) => {
  try {
    const calendarData = {
      ...req.body,
      createdBy: req.user._id
    };

    const calendarEntry = await FarmingCalendar.create(calendarData);

    res.status(201).json({
      success: true,
      message: 'Calendar entry created successfully',
      data: { calendarEntry }
    });
  } catch (error) {
    console.error('Create calendar entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get farming YouTube videos
// @route   GET /api/knowledge/videos
// @access  Public
const getFarmingVideos = async (req, res) => {
  try {
    // Predefined farming YouTube videos
    const farmingVideos = [
      {
        id: 'video1',
        title: 'Sustainable Farming Practices for Small Holders',
        description: 'Learn how to implement sustainable farming practices that improve soil health, reduce water usage, and increase crop yields.',
        url: 'https://www.youtube.com/watch?v=fsgN5UBdXwE',
        thumbnail: 'https://img.youtube.com/vi/fsgN5UBdXwE/hqdefault.jpg',
        category: 'sustainability',
        duration: '14:35',
        channel: 'Farming Future',
        publishedAt: '2023-07-15'
      },
      {
        id: 'video2',
        title: 'Organic Pest Management Solutions',
        description: 'Discover effective organic methods to manage pests in your farm without harmful chemicals.',
        url: 'https://www.youtube.com/watch?v=xQ05z3QF938',
        thumbnail: 'https://img.youtube.com/vi/xQ05z3QF938/hqdefault.jpg',
        category: 'pest_control',
        duration: '18:22',
        channel: 'Organic Farming Today',
        publishedAt: '2023-08-24'
      },
      {
        id: 'video3',
        title: 'Water Conservation Techniques for Dry Season Farming',
        description: 'Essential water conservation strategies to help your crops thrive during dry seasons.',
        url: 'https://www.youtube.com/watch?v=l9RjhRnXbNQ',
        thumbnail: 'https://img.youtube.com/vi/l9RjhRnXbNQ/hqdefault.jpg',
        category: 'irrigation',
        duration: '22:17',
        channel: 'Smart Farm Solutions',
        publishedAt: '2023-06-11'
      },
      {
        id: 'video4',
        title: 'Maximizing Yields with Crop Rotation',
        description: 'Learn how to plan and implement effective crop rotation to improve soil fertility and crop yields.',
        url: 'https://www.youtube.com/watch?v=OxnmBtIx1wU',
        thumbnail: 'https://img.youtube.com/vi/OxnmBtIx1wU/hqdefault.jpg',
        category: 'crop_farming',
        duration: '16:48',
        channel: 'Farm Science',
        publishedAt: '2023-05-29'
      },
      {
        id: 'video5',
        title: 'Small-Scale Livestock Management Best Practices',
        description: 'Expert advice on managing livestock for small-scale farmers, including health, feeding, and housing.',
        url: 'https://www.youtube.com/watch?v=O_SYPWNbVdY',
        thumbnail: 'https://img.youtube.com/vi/O_SYPWNbVdY/hqdefault.jpg',
        category: 'livestock',
        duration: '25:12',
        channel: 'Modern Farmer',
        publishedAt: '2023-09-03'
      },
      {
        id: 'video6',
        title: 'Soil Health Management and Testing',
        description: 'How to test and maintain optimal soil health for maximum productivity in your farm.',
        url: 'https://www.youtube.com/watch?v=LR5Oe2KR-Sg',
        thumbnail: 'https://img.youtube.com/vi/LR5Oe2KR-Sg/hqdefault.jpg',
        category: 'soil_management',
        duration: '19:45',
        channel: 'Agricultural Science',
        publishedAt: '2023-04-17'
      },
      {
        id: 'video7',
        title: 'Post-Harvest Handling for Small Farms',
        description: 'Learn proper techniques for handling, storing, and processing farm produce after harvest to minimize losses.',
        url: 'https://www.youtube.com/watch?v=SnPrVkW7fYo',
        thumbnail: 'https://img.youtube.com/vi/SnPrVkW7fYo/hqdefault.jpg',
        category: 'post_harvest',
        duration: '21:30',
        channel: 'Harvest Smart',
        publishedAt: '2023-08-10'
      },
      {
        id: 'video8',
        title: 'Farm Business Planning and Market Access',
        description: 'How to create a farm business plan and access markets for your agricultural products.',
        url: 'https://www.youtube.com/watch?v=s-OrF2SMX60',
        thumbnail: 'https://img.youtube.com/vi/s-OrF2SMX60/hqdefault.jpg',
        category: 'marketing',
        duration: '30:15',
        channel: 'Farm Business Success',
        publishedAt: '2023-07-26'
      }
    ];

    // Filter videos based on category if provided
    let filteredVideos = farmingVideos;
    if (req.query.category) {
      filteredVideos = farmingVideos.filter(video => video.category === req.query.category);
    }

    // Search functionality
    if (req.query.search) {
      const searchTerm = req.query.search.toLowerCase();
      filteredVideos = filteredVideos.filter(video => 
        video.title.toLowerCase().includes(searchTerm) || 
        video.description.toLowerCase().includes(searchTerm)
      );
    }

    res.json({
      success: true,
      data: {
        videos: filteredVideos
      }
    });
  } catch (error) {
    console.error('Get farming videos error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getKnowledgeArticles,
  getKnowledgeArticle,
  createKnowledgeArticle,
  toggleArticleLike,
  getFarmingCalendar,
  createCalendarEntry,
  getFarmingVideos
};
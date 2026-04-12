import express from 'express';
import pb from '../utils/pocketbaseClient.js';
import logger from '../utils/logger.js';

const router = express.Router();

// POST /products/init-products
router.post('/init-products', async (req, res) => {
  const productNames = ['BACON DRIP', 'OG DRIP', 'DIRTY DRIP', 'NUGGETS'];

  // Check which products already exist
  const existingProducts = await pb.collection('products').getFullList();
  const existingNames = new Set(existingProducts.map(p => p.name));

  // Define all products to create
  const allProducts = [
    {
      name: 'BACON DRIP',
      description: 'BACON DRIP',
      hasMedallions: true,
      simplePrice: 10000,
      doublePrice: 12000,
      triplePrice: 14000,
      available: true,
    },
    {
      name: 'OG DRIP',
      description: 'OG DRIP',
      hasMedallions: true,
      simplePrice: 10000,
      doublePrice: 12000,
      triplePrice: 14000,
      available: true,
    },
    {
      name: 'DIRTY DRIP',
      description: 'DIRTY DRIP',
      hasMedallions: true,
      simplePrice: 10000,
      doublePrice: 12000,
      triplePrice: 14000,
      available: true,
    },
    {
      name: 'NUGGETS',
      description: 'NUGGETS',
      hasMedallions: false,
      fixedPrice: 4000,
      available: true,
    },
  ];

  // Filter products that don't exist
  const productsToCreate = allProducts.filter(p => !existingNames.has(p.name));

  if (productsToCreate.length === 0) {
    logger.info('All products already exist');
    return res.json({
      success: true,
      message: 'All products already exist',
      createdCount: 0,
    });
  }

  // Create only the products that don't exist
  const createdProducts = [];
  for (const productData of productsToCreate) {
    const created = await pb.collection('products').create(productData);
    createdProducts.push(created);
    logger.info(`Created product: ${created.name}`);
  }

  logger.info(`Products initialization completed. Created ${createdProducts.length} new products`);

  res.json({
    success: true,
    message: 'Products initialized',
    createdCount: createdProducts.length,
    createdProducts: createdProducts.map(p => ({
      id: p.id,
      name: p.name,
    })),
  });
});

export default router;

npm i 

npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all

npm run start:dev --> for deveopment
npm run start --> for production

Test user - test@gmail.com | pass - 123456
Admin - admin@gmail.com | pass - admin@123

###Features:
-dynamic categories x
-rating/review giving option 
-searching products x
    -category/tag wise
-filtering product (rating/price/date)
-payment 
    -advance payment option x
    -manual x
    -gateway
        -ssl
        -bkash
-user profile
-order list/history
-wishlist
-return policy
-size for dress item / publisher - book item etc (when ordering select size)
-dynamic banner/add
-add/promotion campaign
-multi currency/language
-automatic suggestion for similar products
-product trial form home (dress in virtual reality, book - partial reading)
    -physical trial with pay and return if not likedv (trial order type)
    -virtual (2d image)
    -mixed both
-oAuth/Email/SSO/Social Media login
-sms/email notification
-in app notification
-multitenancy 
-image/images upload to server /s3
-cart should be updated when any products updated

###Admin
-caching
-reporting(pdf/excel)
-barcode scan in/out
-role based access
-multi vendor
-sub category edit option
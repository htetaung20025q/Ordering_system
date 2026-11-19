Act as a Senior Backend Engineer.(Only develop the backend not the frontend, no UI)

Use these two files of requirement: 
FLOW-SYS DATABASE ARCHITECTURE & SQL SPECIFICATION.md and FLOW-SYS SYSTEM WORKFLOW.md

You are working on a project to develop a new online ordering system. the user can create an order, add items to it, and check out. the system should be able to handle multiple orders at a time. the system should also be able to handle multiple users at a time.

The project is built with:
- Framework: Python(FastAPI, SQLAlchemy)
- Database: PostgreSQL
- Architecture : Modular Monolith(Use - KISS, DRY, YAGNI, SOLID)

Domain Contexts: 
- Order Management: CRUD operations for orders and order items.
- Inventory Management: CRUD operations for products and categories, inventory adjustments, stock tracking.
- User Management: CRUD operations for users and user roles.    

Project Goal: 
- Build an API for the online ordering system.
- Make the system scalable and maintainable.
- Follow the best practices of software engineering.

Design Requirements: 
- The system should be able to handle multiple orders at a time. 
- The system should be able to handle multiple users at a time.
- The system should be able to handle multiple products at a time.
- The system should be able to handle multiple categories at a time.
- The system should be able to handle multiple roles at a time.
- The system should be able to handle multiple adjustments at a time.

Functional Requirements: 
1. User Authentication & Authorization: 
    - User Login
    - User Registration
    - User Logout
    - Role-based access control
2. Order Management: 
    - Create Order
    - View Order
    - Update Order
    - Cancel Order
3. Inventory Management: 
    - Create Product
    - View Product
    - Update Product
    - Delete Product
4. Category Management: 
    - Create Category
    - View Category
    - Update Category
    - Delete Category
5. Inventory Adjustment:
    - Create Inventory Adjustment
    - View Inventory Adjustment
    - Update Inventory Adjustment
    - Delete Inventory Adjustment
6. Stock Tracking:
    - View Stock
    - Update Stock
    - Delete Stock
7. Payment Management:
    - Create Payment
    - View Payment
    - Update Payment
    - Delete Payment
8. KDS Display:
    - View KDS Display
    - Update KDS Display
    - Delete KDS Display

Non-Functional Requirements: 
1. Scalability: The system should be able to handle multiple orders at a time. 
2. Maintainability: The system should be easy to maintain. 
3. Performance: The system should be fast and responsive. 
4. Security: The system should be secure. 
5. Availability: The system should be available 24/7.
6. Usability: The system should be easy to use.

Other Requirements:
1. Code should be well-documented.
2. Code should follow the best practices of software engineering.
3. Code should be well-tested.
4. Code should be well-organized.

Need to Defend : 
1. Race Conditions: 
    - Explain the race conditions that can occur in the system. 
2. Concurrency: 
    - Explain the concurrency issues that can occur in the system.
3. Performance: 
    - Explain the performance issues that can occur in the system.
4. Network Reliability: 
    - Explain the network reliability issues that can occur in the system.
5. Data Consistency: 
    - Explain the data consistency issues that can occur in the system.
6. Payment Processing: 
    - Explain the payment processing issues that can occur in the system.

Firstly, User can order after Payment. Secondly, if when user is paying for the order, the payment fails, the order should not be created. 
If the payment is successful, the order should be created. 
If the payment is cancelled, the order should be cancelled.

Need to Defend the code if there are any issues. And if you think there are any issues, please fix them.


Context: 
1. We will use FastAPI for the backend.
2. We will use SQLAlchemy for the ORM.
3. We will use PostgreSQL for the database.
4. We will use KISS, DRY, YAGNI, SOLID for the architecture.
5. We will use Modular Monolith for the architecture.
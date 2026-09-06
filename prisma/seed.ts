import bcrypt from "bcryptjs";
import {
  ApplicationStatus,
  GenderPreference,
  PrismaClient,
  PropertyStatus,
  PropertyType,
  Role,
  RoomType,
} from "@prisma/client";

const prisma = new PrismaClient();

const PASSWORD = "Password123!";

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.billSplitTenant.deleteMany(),
    prisma.billSplit.deleteMany(),
    prisma.rentPayment.deleteMany(),
    prisma.maintenanceRequest.deleteMany(),
    prisma.viewingRequest.deleteMany(),
    prisma.tenancy.deleteMany(),
    prisma.application.deleteMany(),
    prisma.roommatePreference.deleteMany(),
    prisma.room.deleteMany(),
    prisma.property.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const admin = await prisma.user.create({
    data: {
      email: "admin@housing.com",
      passwordHash,
      role: Role.ADMIN,
      name: "Platform Admin",
      phone: "+1-555-0001",
      isVerified: true,
    },
  });

  const owner1 = await prisma.user.create({
    data: {
      email: "owner1@housing.com",
      passwordHash,
      role: Role.OWNER,
      name: "Alice Owner",
      phone: "+1-555-0101",
      isVerified: true,
    },
  });

  const owner2 = await prisma.user.create({
    data: {
      email: "owner2@housing.com",
      passwordHash,
      role: Role.OWNER,
      name: "Bob Landlord",
      phone: "+1-555-0102",
      isVerified: true,
    },
  });

  const tenant1 = await prisma.user.create({
    data: {
      email: "tenant1@housing.com",
      passwordHash,
      role: Role.TENANT,
      name: "Carol Tenant",
      phone: "+1-555-0201",
      isVerified: true,
    },
  });

  const tenant2 = await prisma.user.create({
    data: {
      email: "tenant2@housing.com",
      passwordHash,
      role: Role.TENANT,
      name: "Dave Renter",
      phone: "+1-555-0202",
    },
  });

  const tenant3 = await prisma.user.create({
    data: {
      email: "tenant3@housing.com",
      passwordHash,
      role: Role.TENANT,
      name: "Eve Seeker",
      phone: "+1-555-0203",
    },
  });

  await prisma.property.create({
    data: {
      ownerId: owner1.id,
      title: "Sunrise Apartments",
      description: "Cozy apartment building with rooftop access and gym.",
      address: "245 Broadway",
      city: "New York",
      area: "Manhattan",
      state: "NY",
      zipCode: "10007",
      propertyType: PropertyType.APARTMENT,
      amenities: ["Gym", "Elevator", "Laundry", "Rooftop"],
      images: ["https://example.com/sunrise-1.jpg", "https://example.com/sunrise-2.jpg"],
      status: PropertyStatus.ACTIVE,
      rooms: {
        create: [
          {
            roomType: RoomType.SINGLE,
            rentAmount: 950,
            isAvailable: true,
            capacity: 1,
            images: ["https://example.com/sunrise-r1.jpg"],
          },
          {
            roomType: RoomType.DOUBLE,
            rentAmount: 1400,
            isAvailable: true,
            capacity: 2,
            images: ["https://example.com/sunrise-r2.jpg"],
          },
        ],
      },
    },
  });

  await prisma.property.create({
    data: {
      ownerId: owner1.id,
      title: "Green Valley House",
      description: "Spacious shared house with a garden and parking.",
      address: "88 Park Lane",
      city: "Austin",
      area: "South Congress",
      state: "TX",
      zipCode: "78704",
      propertyType: PropertyType.HOUSE,
      amenities: ["Garden", "Parking", "Pet Friendly", "High-Speed Internet"],
      images: ["https://example.com/greenvalley-1.jpg"],
      status: PropertyStatus.ACTIVE,
      rooms: {
        create: [
          {
            roomType: RoomType.MASTER,
            rentAmount: 1100,
            isAvailable: true,
            capacity: 1,
            images: ["https://example.com/greenvalley-master.jpg"],
          },
          {
            roomType: RoomType.SINGLE,
            rentAmount: 700,
            isAvailable: false,
            capacity: 1,
            images: ["https://example.com/greenvalley-single.jpg"],
          },
        ],
      },
    },
  });

  await prisma.property.create({
    data: {
      ownerId: owner2.id,
      title: "Downtown Studios",
      description: "Modern micro-studios walking distance to the metro.",
      address: "410 5th Avenue",
      city: "Seattle",
      area: "Downtown",
      state: "WA",
      zipCode: "98101",
      propertyType: PropertyType.STUDIO,
      amenities: ["Furnished", "Air Conditioning", "WiFi"],
      images: ["https://example.com/downtown-1.jpg", "https://example.com/downtown-2.jpg"],
      status: PropertyStatus.ACTIVE,
      rooms: {
        create: [
          {
            roomType: RoomType.STUDIO,
            rentAmount: 1650,
            isAvailable: true,
            capacity: 1,
            images: ["https://example.com/downtown-s1.jpg"],
          },
          {
            roomType: RoomType.QUAD,
            rentAmount: 3200,
            isAvailable: true,
            capacity: 4,
            images: ["https://example.com/downtown-quad.jpg"],
          },
        ],
      },
    },
  });

  await prisma.roommatePreference.createMany({
    data: [
      {
        userId: tenant1.id,
        minBudget: 800,
        maxBudget: 1400,
        preferredCity: "New York",
        preferredArea: "Manhattan",
        genderPreference: GenderPreference.ANY,
        lifestyleTags: ["non-smoker", "early-riser", "clean"],
        isSmoker: false,
        hasPets: false,
      },
      {
        userId: tenant2.id,
        minBudget: 600,
        maxBudget: 1000,
        preferredCity: "Austin",
        preferredArea: "South Congress",
        genderPreference: GenderPreference.ANY,
        lifestyleTags: ["night-owl", "social", "pet-friendly"],
        isSmoker: true,
        hasPets: true,
      },
      {
        userId: tenant3.id,
        minBudget: 1200,
        maxBudget: 1800,
        preferredCity: "Seattle",
        preferredArea: "Downtown",
        genderPreference: GenderPreference.FEMALE,
        lifestyleTags: ["non-smoker", "work-from-home", "clean"],
        isSmoker: false,
        hasPets: false,
        moveInDate: new Date("2026-10-01"),
      },
    ],
  });

  const rooms = await prisma.room.findMany();
  await prisma.application.create({
    data: {
      tenantId: tenant1.id,
      roomId: rooms[0].id,
      status: ApplicationStatus.PENDING,
      moveInDate: new Date("2026-10-01"),
      note: "Looking to move in on the 1st of October.",
    },
  });

  console.log("Seeded: 1 admin, 2 owners, 3 tenants, 3 properties with 6 rooms");
  console.log(`Total properties: ${await prisma.property.count()}`);
  console.log(`Total rooms: ${await prisma.room.count()}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
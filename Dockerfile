FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /app
COPY backend ./backend
COPY frontend ./frontend
WORKDIR /app/backend
RUN mvn package -DskipTests
RUN find /app/backend/target -name index.html

FROM eclipse-temurin:25-jre-jammy
WORKDIR /app
COPY --from=build /app/backend/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
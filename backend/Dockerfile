
FROM eclipse-temurin:21-jdk AS build

WORKDIR /app

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./

RUN chmod +x mvnw
RUN ./mvnw -B dependency:go-offline

COPY src/ src/
RUN ./mvnw -B clean package -DskipTests

FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "keytool -importcert -trustcacerts -alias aiven-mysql-ca -file /etc/secrets/ca.pem -keystore /tmp/aiven-truststore.p12 -storetype PKCS12 -storepass changeit -noprompt && exec java -Dserver.port=${PORT:-8080} -jar app.jar"]
